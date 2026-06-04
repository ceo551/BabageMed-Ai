package connectors

// OAuth 2.0 authorization-code flow for connectors — the "Connect → sign in at
// the provider → connected with YOUR account" UX. It feeds the same per-user
// credential path added in v82: the access token obtained here is stored
// (encrypted) on the user's connector row, and Credential() hands it to the MCP
// pod via the X-MCP-Credential header. Each provider activates only when its
// OAuth client id/secret are configured in the environment.

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/pervagans/backend/internal/auth"
	"github.com/go-chi/chi/v5"
)

type oauthFlavor string

const (
	flavorStandard oauthFlavor = "standard" // form body, {access_token,refresh_token,expires_in}
	flavorNotion   oauthFlavor = "notion"   // JSON body + HTTP Basic auth, {access_token} (no expiry)
	flavorSlack    oauthFlavor = "slack"    // form body, token in authed_user.access_token
)

type oauthProvider struct {
	authURL     string
	tokenURL    string
	scopes      []string
	scopeParam  string // "scope" (default) or "user_scope" (Slack)
	flavor      oauthFlavor
	clientIDEnv string
	secretEnv   string
	authParams  map[string]string // extra static params on the authorize URL
}

func (p oauthProvider) clientID() string     { return strings.TrimSpace(os.Getenv(p.clientIDEnv)) }
func (p oauthProvider) clientSecret() string { return strings.TrimSpace(os.Getenv(p.secretEnv)) }
func (p oauthProvider) configured() bool     { return p.clientID() != "" && p.clientSecret() != "" }

// oauthOrder is the stable connector list we report as OAuth-capable.
var oauthOrder = []string{"notion", "gmail", "gcalendar", "gdrive", "slack", "linkedin", "ms365"}

func oauthProviderFor(mcpID string) (oauthProvider, bool) {
	google := func(scope string) oauthProvider {
		return oauthProvider{
			authURL:     "https://accounts.google.com/o/oauth2/v2/auth",
			tokenURL:    "https://oauth2.googleapis.com/token",
			scopes:      []string{scope, "openid"},
			flavor:      flavorStandard,
			clientIDEnv: "GOOGLE_OAUTH_CLIENT_ID",
			secretEnv:   "GOOGLE_OAUTH_CLIENT_SECRET",
			// access_type=offline + prompt=consent → Google returns a refresh_token.
			authParams: map[string]string{"access_type": "offline", "prompt": "consent", "include_granted_scopes": "true"},
		}
	}
	m := map[string]oauthProvider{
		"notion": {
			authURL:     "https://api.notion.com/v1/oauth/authorize",
			tokenURL:    "https://api.notion.com/v1/oauth/token",
			flavor:      flavorNotion,
			clientIDEnv: "NOTION_OAUTH_CLIENT_ID",
			secretEnv:   "NOTION_OAUTH_CLIENT_SECRET",
			authParams:  map[string]string{"owner": "user"},
		},
		"gmail":     google("https://www.googleapis.com/auth/gmail.modify"),
		"gcalendar": google("https://www.googleapis.com/auth/calendar"),
		"gdrive":    google("https://www.googleapis.com/auth/drive"),
		"slack": {
			authURL:     "https://slack.com/oauth/v2/authorize",
			tokenURL:    "https://slack.com/api/oauth.v2.access",
			scopes:      []string{"search:read", "channels:read", "chat:write"},
			scopeParam:  "user_scope", // request a USER token so search.messages works
			flavor:      flavorSlack,
			clientIDEnv: "SLACK_OAUTH_CLIENT_ID",
			secretEnv:   "SLACK_OAUTH_CLIENT_SECRET",
		},
		"linkedin": {
			authURL:     "https://www.linkedin.com/oauth/v2/authorization",
			tokenURL:    "https://www.linkedin.com/oauth/v2/accessToken",
			scopes:      []string{"openid", "profile", "w_member_social"},
			flavor:      flavorStandard,
			clientIDEnv: "LINKEDIN_OAUTH_CLIENT_ID",
			secretEnv:   "LINKEDIN_OAUTH_CLIENT_SECRET",
		},
		"ms365": {
			authURL:     "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
			tokenURL:    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
			scopes:      []string{"offline_access", "User.Read", "Mail.Read", "Calendars.Read", "Files.Read"},
			flavor:      flavorStandard,
			clientIDEnv: "MS365_OAUTH_CLIENT_ID",
			secretEnv:   "MS365_OAUTH_CLIENT_SECRET",
		},
	}
	p, ok := m[mcpID]
	return p, ok
}

var oauthHTTP = &http.Client{Timeout: 20 * time.Second}

type oauthTokens struct {
	access  string
	refresh string
	expires int64 // unix seconds; 0 = does not expire
}

func randToken() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

func oauthRedirectURI() string {
	base := strings.TrimRight(os.Getenv("PUBLIC_BASE_URL"), "/")
	return base + "/api/backend/api/oauth/callback"
}

// readLimited reads at most 1 MiB of a token response body.
func readLimited(r io.Reader) []byte {
	b, _ := io.ReadAll(io.LimitReader(r, 1<<20))
	return b
}

func (p oauthProvider) exchange(ctx context.Context, code, redirectURI, verifier string) (oauthTokens, error) {
	if p.flavor == flavorNotion {
		return p.exchangeNotion(ctx, code, redirectURI)
	}
	return p.exchangeForm(ctx, code, redirectURI, verifier)
}

func (p oauthProvider) exchangeForm(ctx context.Context, code, redirectURI, verifier string) (oauthTokens, error) {
	form := url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {redirectURI},
		"client_id":     {p.clientID()},
		"client_secret": {p.clientSecret()},
	}
	if verifier != "" {
		form.Set("code_verifier", verifier)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.tokenURL, strings.NewReader(form.Encode()))
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
	body := readLimited(res.Body)
	if p.flavor == flavorSlack {
		var r struct {
			OK          bool   `json:"ok"`
			Error       string `json:"error"`
			AccessToken string `json:"access_token"`
			AuthedUser  struct {
				AccessToken string `json:"access_token"`
			} `json:"authed_user"`
		}
		_ = json.Unmarshal(body, &r)
		if !r.OK {
			return oauthTokens{}, fmt.Errorf("slack oauth: %s", r.Error)
		}
		tok := r.AuthedUser.AccessToken
		if tok == "" {
			tok = r.AccessToken
		}
		if tok == "" {
			return oauthTokens{}, fmt.Errorf("slack oauth: no token")
		}
		return oauthTokens{access: tok}, nil // Slack tokens don't expire by default
	}
	var r struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int64  `json:"expires_in"`
		Error        string `json:"error"`
		ErrorDesc    string `json:"error_description"`
	}
	_ = json.Unmarshal(body, &r)
	if r.AccessToken == "" {
		return oauthTokens{}, fmt.Errorf("oauth token error: %s %s", r.Error, r.ErrorDesc)
	}
	t := oauthTokens{access: r.AccessToken, refresh: r.RefreshToken}
	if r.ExpiresIn > 0 {
		t.expires = time.Now().Add(time.Duration(r.ExpiresIn) * time.Second).Unix()
	}
	return t, nil
}

func (p oauthProvider) exchangeNotion(ctx context.Context, code, redirectURI string) (oauthTokens, error) {
	payload, _ := json.Marshal(map[string]string{
		"grant_type":   "authorization_code",
		"code":         code,
		"redirect_uri": redirectURI,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.tokenURL, bytes.NewReader(payload))
	if err != nil {
		return oauthTokens{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	basic := base64.StdEncoding.EncodeToString([]byte(p.clientID() + ":" + p.clientSecret()))
	req.Header.Set("Authorization", "Basic "+basic)
	res, err := oauthHTTP.Do(req)
	if err != nil {
		return oauthTokens{}, err
	}
	defer res.Body.Close()
	body := readLimited(res.Body)
	var r struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
	}
	_ = json.Unmarshal(body, &r)
	if r.AccessToken == "" {
		return oauthTokens{}, fmt.Errorf("notion oauth error: %s", r.Error)
	}
	return oauthTokens{access: r.AccessToken}, nil // Notion access tokens don't expire
}

// refresh trades a refresh_token for a fresh access token (standard flavor only;
// Notion + Slack tokens don't expire so they never reach here).
func (p oauthProvider) refresh(ctx context.Context, refreshToken string) (oauthTokens, error) {
	form := url.Values{
		"grant_type":    {"refresh_token"},
		"refresh_token": {refreshToken},
		"client_id":     {p.clientID()},
		"client_secret": {p.clientSecret()},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.tokenURL, strings.NewReader(form.Encode()))
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
	}
	_ = json.Unmarshal(readLimited(res.Body), &r)
	if r.AccessToken == "" {
		return oauthTokens{}, fmt.Errorf("oauth refresh error: %s", r.Error)
	}
	t := oauthTokens{access: r.AccessToken, refresh: r.RefreshToken}
	if r.ExpiresIn > 0 {
		t.expires = time.Now().Add(time.Duration(r.ExpiresIn) * time.Second).Unix()
	}
	return t, nil
}

// oauthAccessToken returns a currently-valid access token for an OAuth
// connection, transparently refreshing (and persisting the new token) when it
// is within 60s of expiry and a refresh token is available. Notion/Slack tokens
// carry no expiry, so they're returned as-is.
func (s *Service) oauthAccessToken(ctx context.Context, userID, mcpID string, cfg map[string]any) string {
	access := strings.TrimSpace(s.box.Decrypt(asString(cfg["accessToken"])))
	exp := asInt64(cfg["expiresAt"])
	if exp > 0 && time.Now().Unix() > exp-60 {
		refresh := strings.TrimSpace(s.box.Decrypt(asString(cfg["refreshToken"])))
		if refresh != "" {
			if p, ok := oauthProviderFor(mcpID); ok && p.configured() {
				if nt, err := p.refresh(ctx, refresh); err == nil && nt.access != "" {
					if nt.refresh == "" {
						nt.refresh = refresh // providers often omit a fresh refresh token
					}
					access = nt.access
					s.persistOAuthRefresh(ctx, userID, mcpID, nt)
				}
			}
		}
	}
	return access
}

func (s *Service) persistOAuthRefresh(ctx context.Context, userID, mcpID string, t oauthTokens) {
	cfg := map[string]any{"oauth": true, "accessToken": t.access, "refreshToken": t.refresh}
	if t.expires > 0 {
		cfg["expiresAt"] = t.expires
	}
	cfgJSON, err := json.Marshal(s.encryptConfig(cfg))
	if err != nil {
		return
	}
	_, _ = s.db.Pool.Exec(ctx, `UPDATE user_connectors SET config=$3 WHERE user_id=$1 AND mcp_id=$2`, userID, mcpID, cfgJSON)
}

func asString(v any) string { s, _ := v.(string); return s }

func asInt64(v any) int64 {
	switch n := v.(type) {
	case float64:
		return int64(n)
	case int64:
		return n
	case int:
		return int64(n)
	case json.Number:
		i, _ := n.Int64()
		return i
	}
	return 0
}

// ─── HTTP handlers ───────────────────────────────────────────────────────────

// handleOAuthProviders (public): the connector ids that currently have OAuth
// configured, so the frontend can show a real "Connect" (popup) flow for them.
func (s *Service) handleOAuthProviders(w http.ResponseWriter, _ *http.Request) {
	out := []string{}
	for _, id := range oauthOrder {
		if p, ok := oauthProviderFor(id); ok && p.configured() {
			out = append(out, id)
		}
	}
	writeJSON(w, map[string]any{"providers": out}, nil)
}

// handleOAuthStart (auth required): GET /api/connectors/{mcpID}/oauth/start —
// mints a state row and 302-redirects the (popup) browser to the provider's
// authorize page. The proxy preserves the Location header.
func (s *Service) handleOAuthStart(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	if u == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	mcpID := chi.URLParam(r, "mcpID")
	p, ok := oauthProviderFor(mcpID)
	if !ok || !p.configured() {
		http.Error(w, "oauth not available for this connector", http.StatusBadRequest)
		return
	}
	// Opportunistically sweep stale states (15 min TTL).
	_, _ = s.db.Pool.Exec(r.Context(), `DELETE FROM oauth_states WHERE created_at < now() - interval '15 minutes'`)

	state := randToken()
	if _, err := s.db.Pool.Exec(r.Context(),
		`INSERT INTO oauth_states (state, user_id, mcp_id) VALUES ($1,$2,$3)`,
		state, u.ID, mcpID); err != nil {
		log.Printf("oauth: state insert: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	q := url.Values{}
	q.Set("response_type", "code")
	q.Set("client_id", p.clientID())
	q.Set("redirect_uri", oauthRedirectURI())
	q.Set("state", state)
	if len(p.scopes) > 0 {
		sp := p.scopeParam
		if sp == "" {
			sp = "scope"
		}
		q.Set(sp, strings.Join(p.scopes, " "))
	}
	for k, v := range p.authParams {
		q.Set(k, v)
	}
	http.Redirect(w, r, p.authURL+"?"+q.Encode(), http.StatusFound)
}

// handleOAuthCallback (public): GET /api/oauth/callback?code&state — consumes the
// state, exchanges the code, stores the (encrypted) tokens on the user's
// connector row, and returns an HTML page that signals the opener + closes.
func (s *Service) handleOAuthCallback(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	state := q.Get("state")
	code := q.Get("code")
	providerErr := q.Get("error")

	var userID, mcpID, verifier string
	err := s.db.Pool.QueryRow(r.Context(),
		`DELETE FROM oauth_states WHERE state=$1 RETURNING user_id, mcp_id, code_verifier`, state).
		Scan(&userID, &mcpID, &verifier)
	if err != nil {
		oauthDone(w, "", false, "invalid or expired sign-in attempt")
		return
	}
	if providerErr != "" {
		oauthDone(w, mcpID, false, "authorization was denied or cancelled")
		return
	}
	if code == "" {
		oauthDone(w, mcpID, false, "no authorization code returned")
		return
	}
	p, providerOK := oauthProviderFor(mcpID)
	if !providerOK {
		// Not a built-in provider → mcp_id is a remote MCP connector id (UUID).
		s.completeRemoteOAuth(r.Context(), w, userID, mcpID, code, verifier)
		return
	}
	if !p.configured() {
		oauthDone(w, mcpID, false, "this connector is not configured for sign-in")
		return
	}
	tokens, err := p.exchange(r.Context(), code, oauthRedirectURI(), verifier)
	if err != nil {
		log.Printf("oauth: exchange %s: %v", mcpID, err)
		oauthDone(w, mcpID, false, "could not complete the token exchange")
		return
	}
	if err := s.storeOAuth(r.Context(), userID, mcpID, tokens); err != nil {
		log.Printf("oauth: store %s: %v", mcpID, err)
		oauthDone(w, mcpID, false, "could not save the connection")
		return
	}
	oauthDone(w, mcpID, true, "")
}

// storeOAuth upserts the user's connector row with the OAuth tokens (secret
// values encrypted at rest by encryptConfig).
func (s *Service) storeOAuth(ctx context.Context, userID, mcpID string, t oauthTokens) error {
	kind := "api"
	if srv, ok := s.reg.Get(mcpID); ok {
		kind = srv.Kind
	}
	cfg := map[string]any{"oauth": true, "accessToken": t.access}
	if t.refresh != "" {
		cfg["refreshToken"] = t.refresh
	}
	if t.expires > 0 {
		cfg["expiresAt"] = t.expires
	}
	cfgJSON, err := json.Marshal(s.encryptConfig(cfg))
	if err != nil {
		return err
	}
	_, err = s.db.Pool.Exec(ctx, `
        INSERT INTO user_connectors (user_id, mcp_id, kind, config)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, mcp_id) DO UPDATE
        SET config = EXCLUDED.config, connected_at = now()
    `, userID, mcpID, kind, cfgJSON)
	return err
}

// oauthDone writes the popup-closing HTML. All interpolated values are
// JSON-encoded (encoding/json escapes <, >, & by default) so they're safe to
// embed in the inline <script>; user-facing messages are fixed literals.
func oauthDone(w http.ResponseWriter, mcpID string, ok bool, errMsg string) {
	origin := strings.TrimRight(os.Getenv("PUBLIC_BASE_URL"), "/")
	payload, _ := json.Marshal(map[string]any{"type": "pervagans-oauth", "mcpId": mcpID, "ok": ok})
	originJSON, _ := json.Marshal(origin)
	human := "Connected. You can close this window."
	if !ok {
		human = "Sign-in failed: " + errMsg + ". You can close this window."
	}
	humanJSON, _ := json.Marshal(human)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = fmt.Fprintf(w, `<!doctype html><html><head><meta charset="utf-8"><title>Pervagans</title></head>`+
		`<body style="font-family:system-ui,-apple-system,sans-serif;background:#0a0a0c;color:#e6e6e6;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">`+
		`<p id="m" style="opacity:.85"></p><script>(function(){var msg=%s,origin=%s,human=%s;`+
		`try{if(window.opener){window.opener.postMessage(msg,origin);}}catch(e){}`+
		`document.getElementById('m').textContent=human;`+
		`if(window.opener){setTimeout(function(){try{window.close();}catch(e){}},900);}`+
		`else{location.replace(origin+'/mcps'+(msg.ok?'?connected='+encodeURIComponent(msg.mcpId):'?oauth_error=1'));}})();</script>`+
		`</body></html>`, string(payload), string(originJSON), string(humanJSON))
}
