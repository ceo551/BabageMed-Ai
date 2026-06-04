package connectors

// Remote MCP connectors — connect to an external MCP server (e.g.
// https://mcp.notion.com/mcp) the way Claude/Perplexity/Manus do: the MCP
// authorization flow (OAuth 2.0 + Dynamic Client Registration + PKCE). No
// operator app registration — we register a client dynamically per server, the
// user signs in at the provider, and we store their token (encrypted) to call
// the server's tools as them. Confirmed against Notion's hosted MCP server.

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/pervagans/backend/internal/auth"
	"github.com/pervagans/backend/internal/mcp"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

// ─── OAuth discovery (MCP authorization spec) ────────────────────────────────

type asMetadata struct {
	AuthorizationEndpoint string `json:"authorization_endpoint"`
	TokenEndpoint         string `json:"token_endpoint"`
	RegistrationEndpoint  string `json:"registration_endpoint"`
}

// discoverOAuth resolves the authorization-server endpoints for an MCP server:
// probe the server for the protected-resource metadata pointer → fetch it (for
// the authorization server + the scopes it accepts) → fetch the authorization-
// server metadata. Returns the AS metadata, its issuer (for the pre-registered-
// client lookup when there's no DCR), and the resource's supported scopes.
func discoverOAuth(ctx context.Context, serverURL string) (meta asMetadata, issuer string, scopes []string, err error) {
	resourceMeta := probeResourceMetadata(ctx, serverURL)
	var as string
	if resourceMeta != "" {
		servers, sc := fetchProtectedResource(ctx, resourceMeta)
		scopes = sc
		if len(servers) > 0 {
			as = servers[0]
		}
	}
	if as == "" {
		if u, e := url.Parse(serverURL); e == nil && u.Host != "" {
			as = u.Scheme + "://" + u.Host
		}
	}
	if as == "" {
		return asMetadata{}, "", nil, errors.New("could not locate the OAuth authorization server")
	}
	issuer = strings.TrimRight(as, "/")
	meta, err = fetchASMetadata(ctx, as)
	return meta, issuer, scopes, err
}

// preregisteredFor returns the env var names of an OAuth client the OPERATOR
// registered for an authorization server that does NOT support dynamic client
// registration (notably Google). One app per provider → all users connect with
// zero per-user setup, which is exactly how Claude ships "Claude for Gmail".
func preregisteredFor(issuer string) (idEnv, secretEnv string, ok bool) {
	switch strings.TrimRight(issuer, "/") {
	case "https://accounts.google.com", "http://accounts.google.com":
		return "GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", true
	}
	return "", "", false
}

func isGoogleIssuer(issuer string) bool { return strings.Contains(issuer, "accounts.google.com") }

// filterScopes drops scopes that are mutually exclusive with broader ones in the
// same set (e.g. Gmail's .metadata scope can't be combined with full access).
func filterScopes(scopes []string) []string {
	out := []string{}
	for _, sc := range scopes {
		if strings.HasSuffix(sc, ".metadata") {
			continue
		}
		out = append(out, sc)
	}
	return out
}

func probeResourceMetadata(ctx context.Context, serverURL string) string {
	body := []byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"Pervagans","version":"1"}}}`)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, serverURL, bytes.NewReader(body))
	if err == nil {
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept", "application/json, text/event-stream")
		if res, e := oauthHTTP.Do(req); e == nil {
			defer res.Body.Close()
			if rm := parseResourceMetadata(res.Header.Get("WWW-Authenticate")); rm != "" {
				return rm
			}
		}
	}
	if u, e := url.Parse(serverURL); e == nil && u.Host != "" {
		return u.Scheme + "://" + u.Host + "/.well-known/oauth-protected-resource"
	}
	return ""
}

// parseResourceMetadata extracts resource_metadata="..." from a WWW-Authenticate
// header value.
func parseResourceMetadata(wwwAuth string) string {
	const key = "resource_metadata="
	i := strings.Index(wwwAuth, key)
	if i < 0 {
		return ""
	}
	rest := strings.TrimSpace(wwwAuth[i+len(key):])
	if strings.HasPrefix(rest, `"`) {
		rest = rest[1:]
		if q := strings.IndexByte(rest, '"'); q >= 0 {
			return rest[:q]
		}
		return ""
	}
	if c := strings.IndexAny(rest, ", "); c >= 0 {
		return rest[:c]
	}
	return rest
}

func fetchProtectedResource(ctx context.Context, metaURL string) (servers []string, scopes []string) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, metaURL, nil)
	if err != nil {
		return nil, nil
	}
	req.Header.Set("Accept", "application/json")
	res, err := oauthHTTP.Do(req)
	if err != nil {
		return nil, nil
	}
	defer res.Body.Close()
	if res.StatusCode >= 400 {
		return nil, nil
	}
	var m struct {
		AuthorizationServers []string `json:"authorization_servers"`
		ScopesSupported      []string `json:"scopes_supported"`
	}
	_ = json.Unmarshal(readLimited(res.Body), &m)
	return m.AuthorizationServers, m.ScopesSupported
}

func fetchASMetadata(ctx context.Context, as string) (asMetadata, error) {
	as = strings.TrimRight(as, "/")
	for _, suffix := range []string{"/.well-known/oauth-authorization-server", "/.well-known/openid-configuration"} {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, as+suffix, nil)
		if err != nil {
			continue
		}
		req.Header.Set("Accept", "application/json")
		res, err := oauthHTTP.Do(req)
		if err != nil {
			continue
		}
		body := readLimited(res.Body)
		res.Body.Close()
		if res.StatusCode >= 400 {
			continue
		}
		var m asMetadata
		if json.Unmarshal(body, &m) == nil && m.AuthorizationEndpoint != "" && m.TokenEndpoint != "" {
			return m, nil
		}
	}
	return asMetadata{}, errors.New("authorization server metadata not found")
}

// registerClient performs Dynamic Client Registration → a fresh public client_id
// (and secret if the server issues one). This is what removes any manual app
// registration.
func registerClient(ctx context.Context, registrationEndpoint, redirectURI string) (clientID, clientSecret string, err error) {
	if registrationEndpoint == "" {
		return "", "", errors.New("this server does not support dynamic client registration")
	}
	payload, _ := json.Marshal(map[string]any{
		"client_name":                "Pervagans",
		"redirect_uris":              []string{redirectURI},
		"grant_types":                []string{"authorization_code", "refresh_token"},
		"response_types":             []string{"code"},
		"token_endpoint_auth_method": "none",
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, registrationEndpoint, bytes.NewReader(payload))
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	res, err := oauthHTTP.Do(req)
	if err != nil {
		return "", "", err
	}
	defer res.Body.Close()
	body := readLimited(res.Body)
	if res.StatusCode >= 400 {
		return "", "", fmt.Errorf("client registration failed: %s", res.Status)
	}
	var m struct {
		ClientID     string `json:"client_id"`
		ClientSecret string `json:"client_secret"`
	}
	if json.Unmarshal(body, &m) != nil || m.ClientID == "" {
		return "", "", errors.New("client registration returned no client_id")
	}
	return m.ClientID, m.ClientSecret, nil
}

func pkce() (verifier, challenge string) {
	verifier = randToken() // 43-char base64url — a valid PKCE verifier
	sum := sha256.Sum256([]byte(verifier))
	challenge = base64.RawURLEncoding.EncodeToString(sum[:])
	return
}

func validHTTPSURL(s string) bool {
	u, err := url.Parse(s)
	return err == nil && u.Scheme == "https" && u.Host != "" && len(s) <= 2048
}

func hostName(s string) string {
	if u, err := url.Parse(s); err == nil && u.Host != "" {
		return strings.TrimPrefix(u.Host, "www.")
	}
	return s
}

// ─── persistence ─────────────────────────────────────────────────────────────

type remoteRow struct {
	ID           string
	Name         string
	ServerURL    string
	TokenURL     string
	ClientID     string
	ClientSecret string // decrypted
	AccessToken  string // decrypted
	RefreshToken string // decrypted
	ExpiresAt    int64
	Connected    bool
}

func (s *Service) loadRemote(ctx context.Context, userID, id string) (remoteRow, error) {
	var r remoteRow
	var cs, at, rt string
	err := s.db.Pool.QueryRow(ctx, `
        SELECT id::text, name, server_url, token_url, client_id, client_secret, access_token, refresh_token, expires_at, connected
        FROM remote_connectors WHERE user_id=$1 AND id=$2`, userID, id).
		Scan(&r.ID, &r.Name, &r.ServerURL, &r.TokenURL, &r.ClientID, &cs, &at, &rt, &r.ExpiresAt, &r.Connected)
	if err != nil {
		return remoteRow{}, err
	}
	r.ClientSecret = s.box.Decrypt(cs)
	r.AccessToken = s.box.Decrypt(at)
	r.RefreshToken = s.box.Decrypt(rt)
	return r, nil
}

// ─── HTTP handlers ───────────────────────────────────────────────────────────

// handleRemoteStart (auth): POST /api/remote-connectors {url,name?} — discovers
// OAuth, dynamically registers a client, creates the connector row + PKCE state,
// and returns the provider authorize URL for the frontend popup to navigate to.
func (s *Service) handleRemoteStart(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	if u == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 8<<10)
	var body struct {
		URL  string `json:"url"`
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	serverURL := strings.TrimSpace(body.URL)
	if !validHTTPSURL(serverURL) {
		http.Error(w, "a valid https MCP server URL is required", http.StatusBadRequest)
		return
	}
	ctx := r.Context()
	meta, issuer, scopes, err := discoverOAuth(ctx, serverURL)
	if err != nil {
		log.Printf("remote: discover %s: %v", serverURL, err)
		http.Error(w, "could not discover OAuth for this server", http.StatusBadGateway)
		return
	}
	redirectURI := oauthRedirectURI()
	var clientID, clientSecret string
	if meta.RegistrationEndpoint != "" {
		// Dynamic Client Registration — zero operator setup (Notion, Slack, …).
		clientID, clientSecret, err = registerClient(ctx, meta.RegistrationEndpoint, redirectURI)
		if err != nil {
			log.Printf("remote: register %s: %v", serverURL, err)
			http.Error(w, "could not register with this server", http.StatusBadGateway)
			return
		}
	} else if idEnv, secretEnv, ok := preregisteredFor(issuer); ok {
		// No DCR (e.g. Google) — use the OPERATOR's pre-registered app, exactly
		// the model Claude uses for "Claude for Gmail". One app, all users.
		clientID = strings.TrimSpace(os.Getenv(idEnv))
		clientSecret = strings.TrimSpace(os.Getenv(secretEnv))
		if clientID == "" {
			http.Error(w, "this provider needs an OAuth app configured by the operator", http.StatusBadRequest)
			return
		}
	} else {
		http.Error(w, "this server needs a pre-registered OAuth client", http.StatusBadRequest)
		return
	}
	name := strings.TrimSpace(body.Name)
	if name == "" {
		name = hostName(serverURL)
	}
	var id string
	err = s.db.Pool.QueryRow(ctx, `
        INSERT INTO remote_connectors (user_id, name, server_url, authorize_url, token_url, client_id, client_secret, connected)
        VALUES ($1,$2,$3,$4,$5,$6,$7,false)
        ON CONFLICT (user_id, server_url) DO UPDATE
        SET name=EXCLUDED.name, authorize_url=EXCLUDED.authorize_url, token_url=EXCLUDED.token_url,
            client_id=EXCLUDED.client_id, client_secret=EXCLUDED.client_secret
        RETURNING id::text`,
		u.ID, name, serverURL, meta.AuthorizationEndpoint, meta.TokenEndpoint, clientID, s.box.Encrypt(clientSecret)).Scan(&id)
	if err != nil {
		log.Printf("remote: upsert: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	verifier, challenge := pkce()
	state := randToken()
	if _, err := s.db.Pool.Exec(ctx,
		`INSERT INTO oauth_states (state, user_id, mcp_id, code_verifier) VALUES ($1,$2,$3,$4)`,
		state, u.ID, id, verifier); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	q := url.Values{}
	q.Set("response_type", "code")
	q.Set("client_id", clientID)
	q.Set("redirect_uri", redirectURI)
	q.Set("state", state)
	q.Set("code_challenge", challenge)
	q.Set("code_challenge_method", "S256")
	q.Set("resource", serverURL)
	if sc := filterScopes(scopes); len(sc) > 0 {
		q.Set("scope", strings.Join(sc, " "))
	}
	if isGoogleIssuer(issuer) {
		// access_type=offline + prompt=consent → Google returns a refresh token.
		q.Set("access_type", "offline")
		q.Set("prompt", "consent")
	}
	writeJSON(w, map[string]any{"id": id, "authorizeUrl": meta.AuthorizationEndpoint + "?" + q.Encode()}, nil)
}

// completeRemoteOAuth is called from the shared callback when the state's mcp_id
// is a remote connector id (a UUID) rather than a built-in provider.
func (s *Service) completeRemoteOAuth(ctx context.Context, w http.ResponseWriter, userID, id, code, verifier string) {
	rc, err := s.loadRemote(ctx, userID, id)
	if err != nil {
		oauthDone(w, id, false, "connection not found")
		return
	}
	tokens, err := exchangeRemoteCode(ctx, rc, code, oauthRedirectURI(), verifier)
	if err != nil {
		log.Printf("remote: exchange %s: %v", rc.ServerURL, err)
		oauthDone(w, id, false, "could not complete the token exchange")
		return
	}
	_, err = s.db.Pool.Exec(ctx, `
        UPDATE remote_connectors SET access_token=$3, refresh_token=$4, expires_at=$5, connected=true
        WHERE user_id=$1 AND id=$2`,
		userID, id, s.box.Encrypt(tokens.access), s.box.Encrypt(tokens.refresh), tokens.expires)
	if err != nil {
		log.Printf("remote: store tokens: %v", err)
		oauthDone(w, id, false, "could not save the connection")
		return
	}
	oauthDone(w, id, true, "")
}

func exchangeRemoteCode(ctx context.Context, rc remoteRow, code, redirectURI, verifier string) (oauthTokens, error) {
	form := url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {redirectURI},
		"client_id":     {rc.ClientID},
		"code_verifier": {verifier},
		"resource":      {rc.ServerURL},
	}
	if rc.ClientSecret != "" {
		form.Set("client_secret", rc.ClientSecret)
	}
	return remoteTokenRequest(ctx, rc.TokenURL, form)
}

func remoteTokenRequest(ctx context.Context, tokenURL string, form url.Values) (oauthTokens, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return oauthTokens{}, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	res, err := oauthHTTP.Do(req)
	if err != nil {
		return oauthTokens{}, err
	}
	defer res.Body.Close()
	var r struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int64  `json:"expires_in"`
		Error        string `json:"error"`
		ErrorDesc    string `json:"error_description"`
	}
	_ = json.Unmarshal(readLimited(res.Body), &r)
	if r.AccessToken == "" {
		return oauthTokens{}, fmt.Errorf("token error: %s %s", r.Error, r.ErrorDesc)
	}
	t := oauthTokens{access: r.AccessToken, refresh: r.RefreshToken}
	if r.ExpiresIn > 0 {
		t.expires = time.Now().Add(time.Duration(r.ExpiresIn) * time.Second).Unix()
	}
	return t, nil
}

// remoteAccessToken returns a valid bearer for a remote connector, refreshing +
// persisting when it's within 60s of expiry.
func (s *Service) remoteAccessToken(ctx context.Context, userID string, rc remoteRow) string {
	access := rc.AccessToken
	if rc.ExpiresAt > 0 && time.Now().Unix() > rc.ExpiresAt-60 && rc.RefreshToken != "" {
		form := url.Values{
			"grant_type":    {"refresh_token"},
			"refresh_token": {rc.RefreshToken},
			"client_id":     {rc.ClientID},
			"resource":      {rc.ServerURL},
		}
		if rc.ClientSecret != "" {
			form.Set("client_secret", rc.ClientSecret)
		}
		if nt, err := remoteTokenRequest(ctx, rc.TokenURL, form); err == nil && nt.access != "" {
			access = nt.access
			refresh := nt.refresh
			if refresh == "" {
				refresh = rc.RefreshToken
			}
			_, _ = s.db.Pool.Exec(ctx, `UPDATE remote_connectors SET access_token=$3, refresh_token=$4, expires_at=$5 WHERE user_id=$1 AND id=$2`,
				userID, rc.ID, s.box.Encrypt(access), s.box.Encrypt(refresh), nt.expires)
		}
	}
	return access
}

// handleRemoteList (auth): GET /api/remote-connectors — the user's remote
// connectors (no tokens).
func (s *Service) handleRemoteList(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	rows, err := s.db.Pool.Query(r.Context(),
		`SELECT id::text, name, server_url, connected, created_at FROM remote_connectors WHERE user_id=$1 ORDER BY created_at DESC`, u.ID)
	if err != nil {
		writeJSON(w, nil, err)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, name, serverURL string
		var connected bool
		var created time.Time
		if err := rows.Scan(&id, &name, &serverURL, &connected, &created); err != nil {
			writeJSON(w, nil, err)
			return
		}
		out = append(out, map[string]any{"id": id, "name": name, "serverUrl": serverURL, "connected": connected, "connectedAt": created.UTC().Format(time.RFC3339)})
	}
	writeJSON(w, map[string]any{"connectors": out}, rows.Err())
}

// handleRemoteDelete (auth): DELETE /api/remote-connectors/{id}.
func (s *Service) handleRemoteDelete(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	id := chi.URLParam(r, "id")
	tag, err := s.db.Pool.Exec(r.Context(), `DELETE FROM remote_connectors WHERE user_id=$1 AND id=$2`, u.ID, id)
	if err != nil {
		writeJSON(w, nil, err)
		return
	}
	if tag.RowsAffected() == 0 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleRemoteTools (auth): GET /api/remote-connectors/{id}/tools — JSON-RPC
// tools/list against the remote server with the user's bearer (proves the
// connection + powers the UI tool chips).
func (s *Service) handleRemoteTools(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	id := chi.URLParam(r, "id")
	rc, err := s.loadRemote(r.Context(), u.ID, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		writeJSON(w, nil, err)
		return
	}
	if !rc.Connected || rc.AccessToken == "" {
		http.Error(w, "not connected", http.StatusConflict)
		return
	}
	bearer := s.remoteAccessToken(r.Context(), u.ID, rc)
	tools, err := listRemoteTools(r.Context(), rc.ServerURL, bearer)
	if err != nil {
		log.Printf("remote: tools/list %s: %v", rc.ServerURL, err)
		http.Error(w, "could not list tools", http.StatusBadGateway)
		return
	}
	writeJSON(w, map[string]any{"tools": tools}, nil)
}

// ─── minimal Streamable-HTTP JSON-RPC client ─────────────────────────────────

// Cap on a remote MCP server's response body (mirrors the registry's 4 MiB).
const maxRemoteResponseBytes = 4 << 20

type rpcTool struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	InputSchema map[string]any `json:"inputSchema"`
}

// callRemoteTool initialises an MCP session then invokes tools/call.
func callRemoteTool(ctx context.Context, serverURL, bearer, tool string, args map[string]any) (json.RawMessage, error) {
	_, sid, err := remoteRPC(ctx, serverURL, bearer, "", "initialize", map[string]any{
		"protocolVersion": "2025-06-18",
		"capabilities":    map[string]any{},
		"clientInfo":      map[string]any{"name": "Pervagans", "version": "1"},
	})
	if err != nil {
		return nil, err
	}
	raw, _, err := remoteRPC(ctx, serverURL, bearer, sid, "tools/call", map[string]any{"name": tool, "arguments": args})
	return raw, err
}

// maxRemoteConnectorsPerRun caps how many of a user's remote servers the agent
// will enumerate per run (each costs an initialize + tools/list round trip).
const maxRemoteConnectorsPerRun = 5

// RemoteAgentTools returns the tools of the user's connected remote MCP servers,
// flattened, with each server's bearer resolved (refreshed if needed). Network-
// bound, so it's capped + time-boxed. Implements the agent's remoteProvider.
func (s *Service) RemoteAgentTools(ctx context.Context, userID string) []mcp.RemoteTool {
	if s == nil || s.db == nil {
		return nil
	}
	rows, err := s.db.Pool.Query(ctx,
		`SELECT id::text FROM remote_connectors WHERE user_id=$1 AND connected=true ORDER BY created_at DESC LIMIT $2`,
		userID, maxRemoteConnectorsPerRun)
	if err != nil {
		return nil
	}
	ids := []string{}
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil {
			ids = append(ids, id)
		}
	}
	rows.Close()

	out := []mcp.RemoteTool{}
	for _, id := range ids {
		rc, err := s.loadRemote(ctx, userID, id)
		if err != nil || !rc.Connected || rc.AccessToken == "" {
			continue
		}
		bearer := s.remoteAccessToken(ctx, userID, rc)
		cctx, cancel := context.WithTimeout(ctx, 6*time.Second)
		tools, err := listRemoteTools(cctx, rc.ServerURL, bearer)
		cancel()
		if err != nil {
			continue
		}
		for _, t := range tools {
			if t.Name == "" {
				continue
			}
			out = append(out, mcp.RemoteTool{ConnectorID: id, Name: t.Name, Description: t.Description, InputSchema: t.InputSchema})
		}
	}
	return out
}

// CallRemoteTool invokes a tool on one of the user's connected remote MCP
// servers. Implements the agent's remoteProvider.
func (s *Service) CallRemoteTool(ctx context.Context, userID, connectorID, tool string, args map[string]any) (any, error) {
	if s == nil || s.db == nil {
		return nil, errors.New("unavailable")
	}
	rc, err := s.loadRemote(ctx, userID, connectorID)
	if err != nil {
		return nil, err
	}
	if !rc.Connected || rc.AccessToken == "" {
		return nil, errors.New("not connected")
	}
	bearer := s.remoteAccessToken(ctx, userID, rc)
	raw, err := callRemoteTool(ctx, rc.ServerURL, bearer, tool, args)
	if err != nil {
		return nil, err
	}
	var result any
	_ = json.Unmarshal(raw, &result)
	return result, nil
}

// listRemoteTools initialises an MCP session then calls tools/list.
func listRemoteTools(ctx context.Context, serverURL, bearer string) ([]rpcTool, error) {
	_, sid, err := remoteRPC(ctx, serverURL, bearer, "", "initialize", map[string]any{
		"protocolVersion": "2025-06-18",
		"capabilities":    map[string]any{},
		"clientInfo":      map[string]any{"name": "Pervagans", "version": "1"},
	})
	if err != nil {
		return nil, err
	}
	raw, _, err := remoteRPC(ctx, serverURL, bearer, sid, "tools/list", map[string]any{})
	if err != nil {
		return nil, err
	}
	var out struct {
		Tools []rpcTool `json:"tools"`
	}
	_ = json.Unmarshal(raw, &out)
	return out.Tools, nil
}

// remoteRPC issues a single JSON-RPC call over Streamable HTTP, returning the
// `result` payload + any Mcp-Session-Id the server assigned. Handles both a
// plain JSON response and a one-shot SSE (`data:` line) response.
func remoteRPC(ctx context.Context, serverURL, bearer, sessionID, method string, params any) (json.RawMessage, string, error) {
	reqBody, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": 1, "method": method, "params": params})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, serverURL, bytes.NewReader(reqBody))
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	if sessionID != "" {
		req.Header.Set("Mcp-Session-Id", sessionID)
	}
	res, err := oauthHTTP.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer res.Body.Close()
	sid := res.Header.Get("Mcp-Session-Id")
	if sid == "" {
		sid = sessionID
	}
	body, _ := io.ReadAll(io.LimitReader(res.Body, maxRemoteResponseBytes))
	if res.StatusCode >= 400 {
		return nil, sid, fmt.Errorf("%s: %s", method, res.Status)
	}
	payload := extractJSONRPC(body, res.Header.Get("Content-Type"))
	var env struct {
		Result json.RawMessage `json:"result"`
		Error  *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if json.Unmarshal(payload, &env) != nil {
		return nil, sid, fmt.Errorf("%s: bad response", method)
	}
	if env.Error != nil {
		return nil, sid, fmt.Errorf("%s: %s", method, env.Error.Message)
	}
	return env.Result, sid, nil
}

// extractJSONRPC returns the JSON object from either a plain JSON body or the
// last `data:` line of an SSE body.
func extractJSONRPC(body []byte, contentType string) []byte {
	if strings.Contains(contentType, "text/event-stream") {
		var last []byte
		for _, line := range strings.Split(string(body), "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "data:") {
				last = []byte(strings.TrimSpace(line[len("data:"):]))
			}
		}
		if len(last) > 0 {
			return last
		}
	}
	return body
}
