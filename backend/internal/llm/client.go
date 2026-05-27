package llm

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/babagemed/backend/internal/metrics"
	"github.com/babagemed/backend/internal/tracing"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

type Config struct {
	AnthropicKey string
	// GoogleKey is the AI Studio API key (legacy / free-tier path).
	GoogleKey string
	// VertexProject / VertexLocation switch the Google branch to Vertex AI.
	// When VertexProject is set, callGoogle uses an OAuth bearer derived from
	// Application Default Credentials (Workload Identity Federation in-pod)
	// and ignores GoogleKey.
	VertexProject  string
	VertexLocation string
	// VertexAnthropicLocation is a SEPARATE region for Anthropic-on-Vertex
	// because Claude is only available in a small set of regions (us-east5,
	// europe-west1, asia-southeast1) — distinct from the Gemini region.
	// Empty → defaults to us-east5 in the request builder.
	VertexAnthropicLocation string
	OpenAIKey               string
}

type Client struct {
	cfg  Config
	http *http.Client
	// Vertex AI access tokens are valid for ~1h; cache + refresh through the
	// google.FindDefaultCredentials TokenSource (which itself handles the
	// federated-token → impersonation dance).
	// gcpTS is cached for the lifetime of the process once acquired.
	// Failures are NOT memoised so a brief ADC outage at startup doesn't
	// poison every later request.
	gcpTSMu sync.RWMutex
	gcpTS   oauth2.TokenSource
}

func NewClient(cfg Config) *Client {
	return &Client{cfg: cfg, http: tracing.HTTPClient(&http.Client{Timeout: 120 * time.Second})}
}

// vertexTokenSource lazily resolves Application Default Credentials and
// caches the resulting TokenSource. The returned source auto-refreshes
// expired tokens — we just call .Token() per request.
//
// IMPORTANT: we pass context.Background() to FindDefaultCredentials, NOT
// the per-request ctx. The TokenSource that comes back holds a long-lived
// HTTP client whose context is reused for every STS exchange + IAM
// impersonation call. If we seed it with a request context, the moment
// that request ends (or the user navigates away) all future token fetches
// blow up with "context canceled" — which is exactly the bug observed:
//   vertex token: oauth2/google: unable to generate access token: ...
//   :generateAccessToken: context canceled
// External-account credentials in particular need a stable context because
// every Token() call triggers fresh STS + impersonation HTTPs.
func (c *Client) vertexTokenSource() (oauth2.TokenSource, error) {
	// Fast path: a successful TokenSource is cached for the pod's life.
	c.gcpTSMu.RLock()
	ts := c.gcpTS
	c.gcpTSMu.RUnlock()
	if ts != nil {
		return ts, nil
	}
	// Slow path: re-attempt on every call when there's no cached source.
	// The previous sync.Once design memoised the FAILURE too, so a brief
	// ADC outage at process start poisoned every subsequent Vertex call
	// for the rest of the pod's life (only fixed by a restart). We now
	// only memo on success.
	c.gcpTSMu.Lock()
	defer c.gcpTSMu.Unlock()
	if c.gcpTS != nil {
		return c.gcpTS, nil
	}
	creds, err := google.FindDefaultCredentials(context.Background(), "https://www.googleapis.com/auth/cloud-platform")
	if err != nil {
		return nil, fmt.Errorf("ADC: %w", err)
	}
	c.gcpTS = creds.TokenSource
	return c.gcpTS, nil
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type CompletionRequest struct {
	Model    string    `json:"model"`
	Messages []Message `json:"messages"`
	Mode     string    `json:"mode"`
	System   string    `json:"system,omitempty"`
}

type CompletionResponse struct {
	Provider string `json:"provider"`
	Model    string `json:"model"`
	Content  string `json:"content"`
}

// CompleteStream calls the right provider with native streaming on and
// forwards each text delta through onDelta. Returns the final aggregated
// response (provider/model/full text) so the caller can persist it.
//
// Each provider speaks a different on-wire stream format — Anthropic + OpenAI
// emit SSE with text deltas in `content_block_delta` / `choices[].delta`;
// Vertex AI streamGenerateContent returns a JSON array streamed chunk by
// chunk where each element is a generateContent-shaped object. We normalise
// all three down to "got more text" callbacks.
func (c *Client) CompleteStream(ctx context.Context, req CompletionRequest, onDelta func(string)) (*CompletionResponse, error) {
	start := time.Now()
	provider := "anthropic"
	var out *CompletionResponse
	var err error
	switch {
	case strings.HasPrefix(req.Model, "opus"), strings.HasPrefix(req.Model, "claude"),
		strings.HasPrefix(req.Model, "sonnet"), strings.HasPrefix(req.Model, "haiku"):
		provider = "anthropic"
		// Prefer Anthropic-on-Vertex when a GCP project is wired — no separate
		// Anthropic API key, same Workload Identity Federation as Gemini, bills
		// against the same $300 GCP free credit. Falls back to the direct
		// Anthropic API on error if AnthropicKey is also configured.
		if c.cfg.VertexProject != "" {
			out, err = c.streamVertexAnthropic(ctx, req, onDelta)
			if err != nil && c.cfg.AnthropicKey != "" {
				out, err = c.streamAnthropic(ctx, req, onDelta)
			}
		} else {
			out, err = c.streamAnthropic(ctx, req, onDelta)
		}
	case strings.HasPrefix(req.Model, "gemini"):
		provider = "google"
		out, err = c.streamGoogle(ctx, req, onDelta)
	case strings.HasPrefix(req.Model, "gpt"):
		provider = "openai"
		out, err = c.streamOpenAI(ctx, req, onDelta)
	default:
		provider = "anthropic"
		out, err = c.streamAnthropic(ctx, req, onDelta)
	}
	model := req.Model
	if out != nil && out.Model != "" {
		model = out.Model
	}
	metrics.LLMDuration.WithLabelValues(provider, model).Observe(time.Since(start).Seconds())
	if err != nil {
		metrics.LLMCalls.WithLabelValues(provider, model, "stream_error").Inc()
	} else {
		metrics.LLMCalls.WithLabelValues(provider, model, "stream_ok").Inc()
	}
	return out, err
}

// Complete picks a provider by model id prefix.
func (c *Client) Complete(ctx context.Context, req CompletionRequest) (*CompletionResponse, error) {
	start := time.Now()
	provider := "anthropic"
	var out *CompletionResponse
	var err error
	switch {
	case strings.HasPrefix(req.Model, "opus") || strings.HasPrefix(req.Model, "claude") || strings.HasPrefix(req.Model, "sonnet") || strings.HasPrefix(req.Model, "haiku"):
		provider = "anthropic"
		// Mirror CompleteStream's preference: when a Vertex project is wired
		// we use the Vertex AI Marketplace endpoint for Claude (no separate
		// Anthropic API key, billed via GCP). Fall through to the direct
		// Anthropic path only if Vertex errors AND AnthropicKey is set.
		if c.cfg.VertexProject != "" {
			out, err = c.callVertexAnthropic(ctx, req)
			if err != nil && c.cfg.AnthropicKey != "" {
				out, err = c.callAnthropic(ctx, req)
			}
		} else {
			out, err = c.callAnthropic(ctx, req)
		}
	case strings.HasPrefix(req.Model, "gemini"):
		provider = "google"
		out, err = c.callGoogle(ctx, req)
	case strings.HasPrefix(req.Model, "gpt"):
		provider = "openai"
		out, err = c.callOpenAI(ctx, req)
	default:
		provider = "anthropic"
		out, err = c.callAnthropic(ctx, req)
	}
	model := req.Model
	if out != nil && out.Model != "" {
		model = out.Model
	}
	metrics.LLMDuration.WithLabelValues(provider, model).Observe(time.Since(start).Seconds())
	if err != nil {
		metrics.LLMCalls.WithLabelValues(provider, model, "error").Inc()
	} else {
		metrics.LLMCalls.WithLabelValues(provider, model, "ok").Inc()
	}
	return out, err
}

func (c *Client) callAnthropic(ctx context.Context, req CompletionRequest) (*CompletionResponse, error) {
	if c.cfg.AnthropicKey == "" {
		return nil, errors.New("ANTHROPIC_API_KEY not configured")
	}
	// Source of truth is anthropicModelMap (line 380). The local copy
	// above had drifted — a client sending model="claude-3-5-sonnet"
	// silently became Opus. Use the shared map and pass through unknown
	// IDs verbatim so power users can target a freshly released model
	// without a backend deploy.
	m := resolveAnthropicModel(req.Model)
	body, _ := json.Marshal(map[string]any{
		"model":      m,
		"max_tokens": 4096,
		"system":     req.System,
		"messages":   req.Messages,
	})
	r, _ := http.NewRequestWithContext(ctx, "POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	r.Header.Set("x-api-key", c.cfg.AnthropicKey)
	r.Header.Set("anthropic-version", "2023-06-01")
	r.Header.Set("content-type", "application/json")
	res, err := c.http.Do(r)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("anthropic: %s: %s", res.Status, truncBody(raw))
	}
	var out struct {
		Content []struct{ Text string } `json:"content"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	text := ""
	for _, c := range out.Content {
		text += c.Text
	}
	return &CompletionResponse{Provider: "anthropic", Model: m, Content: text}, nil
}

// callVertexAnthropic is the non-streaming twin of streamVertexAnthropic.
// Used by Complete() (and therefore /api/chat) so anything that doesn't
// hit the SSE path can still talk to Claude via Vertex Marketplace
// without an ANTHROPIC_API_KEY. Endpoint URL ends with :rawPredict instead
// of :streamRawPredict; body identical, response shape identical to the
// direct Anthropic Messages API.
func (c *Client) callVertexAnthropic(ctx context.Context, req CompletionRequest) (*CompletionResponse, error) {
	if c.cfg.VertexProject == "" {
		return nil, errors.New("VertexProject not configured")
	}
	location := c.cfg.VertexAnthropicLocation
	if location == "" {
		location = "us-east5"
	}
	m := anthropicModel(req.Model)
	body, _ := json.Marshal(map[string]any{
		"anthropic_version": "vertex-2023-10-16",
		"max_tokens":        4096,
		"system":            req.System,
		"messages":          req.Messages,
	})
	url := fmt.Sprintf(
		"https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/anthropic/models/%s:rawPredict",
		location, c.cfg.VertexProject, location, m,
	)
	ts, err := c.vertexTokenSource()
	if err != nil {
		return nil, fmt.Errorf("vertex anthropic token source: %w", err)
	}
	tok, err := ts.Token()
	if err != nil {
		return nil, fmt.Errorf("vertex anthropic token: %w", err)
	}
	r, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	r.Header.Set("Authorization", "Bearer "+tok.AccessToken)
	r.Header.Set("content-type", "application/json")
	res, err := c.http.Do(r)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("vertex anthropic: %s: %s", res.Status, truncBody(raw))
	}
	var out struct {
		Content []struct{ Text string } `json:"content"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	text := ""
	for _, blk := range out.Content {
		text += blk.Text
	}
	return &CompletionResponse{Provider: "anthropic-vertex", Model: m, Content: text}, nil
}

// callGoogle dispatches Gemini calls to either Vertex AI (when
// VertexProject is set; uses OAuth bearer from ADC / Workload Identity
// Federation) or the AI Studio generativelanguage endpoint with an API
// key. The wire-level request body shape is identical between the two —
// only the URL + auth header differ.
func (c *Client) callGoogle(ctx context.Context, req CompletionRequest) (*CompletionResponse, error) {
	if c.cfg.VertexProject == "" && c.cfg.GoogleKey == "" {
		return nil, errors.New("neither GOOGLE_CLOUD_PROJECT (Vertex) nor GOOGLE_API_KEY (AI Studio) configured")
	}

	// Body is the same for both endpoints.
	parts := []map[string]any{}
	for _, m := range req.Messages {
		role := m.Role
		if role == "assistant" {
			role = "model"
		}
		parts = append(parts, map[string]any{"role": role, "parts": []map[string]string{{"text": m.Content}}})
	}
	body, _ := json.Marshal(map[string]any{
		"contents":          parts,
		"systemInstruction": map[string]any{"parts": []map[string]string{{"text": req.System}}},
	})

	// Build the request — URL + auth differ per path.
	var r *http.Request
	if c.cfg.VertexProject != "" {
		location := c.cfg.VertexLocation
		if location == "" {
			location = "us-central1"
		}
		// publisher endpoint, gemini-2.5-pro mirrors what was used on AI Studio.
		url := fmt.Sprintf(
			"https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/gemini-2.5-pro:generateContent",
			location, c.cfg.VertexProject, location,
		)
		ts, err := c.vertexTokenSource()
		if err != nil {
			return nil, err
		}
		tok, err := ts.Token()
		if err != nil {
			return nil, fmt.Errorf("vertex token: %w", err)
		}
		r, _ = http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
		r.Header.Set("Authorization", "Bearer "+tok.AccessToken)
	} else {
		url := "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=" + c.cfg.GoogleKey
		r, _ = http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	}
	r.Header.Set("content-type", "application/json")

	res, err := c.http.Do(r)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("google: %s: %s", res.Status, truncBody(raw))
	}
	var out struct {
		Candidates []struct {
			Content struct {
				Parts []struct{ Text string } `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	_ = json.Unmarshal(raw, &out)
	text := ""
	if len(out.Candidates) > 0 {
		for _, p := range out.Candidates[0].Content.Parts {
			text += p.Text
		}
	}
	return &CompletionResponse{Provider: "google", Model: req.Model, Content: text}, nil
}

// ─── Streaming implementations ─────────────────────────────────────────────
// anthropicModelMap reused by both Complete and CompleteStream.
//
// Power users can also pass a fully-qualified model ID (anything starting
// with "claude-") and we forward it verbatim, so a freshly-released
// Anthropic model doesn't need a backend redeploy.
var anthropicModelMap = map[string]string{
	"opus-4.7": "claude-opus-4-7",
	"opus-4.6": "claude-opus-4-6",
	"sonnet":   "claude-sonnet-4-6",
	"haiku":    "claude-haiku-4-5",
}

func anthropicModel(id string) string {
	return resolveAnthropicModel(id)
}

func resolveAnthropicModel(id string) string {
	if id == "" {
		return "claude-opus-4-7"
	}
	if m, ok := anthropicModelMap[id]; ok {
		return m
	}
	// Pass through fully-qualified IDs unchanged.
	if strings.HasPrefix(id, "claude-") {
		return id
	}
	return "claude-opus-4-7"
}

// streamAnthropic POSTs with stream:true and parses the SSE response. The
// only events we care about are content_block_delta with type==text_delta.
func (c *Client) streamAnthropic(ctx context.Context, req CompletionRequest, onDelta func(string)) (*CompletionResponse, error) {
	if c.cfg.AnthropicKey == "" {
		return nil, errors.New("ANTHROPIC_API_KEY not configured")
	}
	model := anthropicModel(req.Model)
	body, _ := json.Marshal(map[string]any{
		"model":      model,
		"max_tokens": 4096,
		"system":     req.System,
		"messages":   req.Messages,
		"stream":     true,
	})
	r, _ := http.NewRequestWithContext(ctx, "POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	r.Header.Set("x-api-key", c.cfg.AnthropicKey)
	r.Header.Set("anthropic-version", "2023-06-01")
	r.Header.Set("content-type", "application/json")
	res, err := c.http.Do(r)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode >= 400 {
		raw, _ := io.ReadAll(res.Body)
		return nil, fmt.Errorf("anthropic stream: %s: %s", res.Status, truncBody(raw))
	}

	var full strings.Builder
	sc := bufio.NewScanner(res.Body)
	// 1 MiB max per SSE line. SSE frames are line-oriented; even a long
	// thinking block arrives as many small lines, not one giant one. The
	// previous 16 MiB cap made a misbehaving provider's no-newline stream
	// a backend-OOM vector multiplied by concurrency.
	sc.Buffer(make([]byte, 0, 64*1024), 1<<20)
	for sc.Scan() {
		line := sc.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		var evt struct {
			Type  string `json:"type"`
			Delta struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"delta"`
		}
		if err := json.Unmarshal([]byte(data), &evt); err != nil {
			continue
		}
		if evt.Type == "content_block_delta" && evt.Delta.Type == "text_delta" && evt.Delta.Text != "" {
			full.WriteString(evt.Delta.Text)
			onDelta(evt.Delta.Text)
		}
	}
	if err := sc.Err(); err != nil {
		return nil, fmt.Errorf("anthropic stream read: %w", err)
	}
	return &CompletionResponse{Provider: "anthropic", Model: model, Content: full.String()}, nil
}

// streamVertexAnthropic calls Claude through Vertex AI's publishers/anthropic
// endpoint. Auth piggybacks on the SAME Workload Identity Federation that
// drives Gemini — no Anthropic API key required. The SSE wire format is
// identical to direct api.anthropic.com (content_block_delta with text_delta),
// so the parser is shared in spirit but inlined here to keep the dependency
// graph flat.
//
// Region defaults to us-east5 because that's where Anthropic's models are
// hosted on Vertex AI today. The Gemini region (typically us-central1) does
// NOT host Anthropic models; calls there 404. Override via env var
// VERTEX_ANTHROPIC_LOCATION if Anthropic adds new regions.
//
// Model availability requires a one-time Marketplace subscription per model:
// see https://console.cloud.google.com/vertex-ai/publishers/anthropic — each
// Claude tier (Opus, Sonnet, Haiku) is its own product to enable.
func (c *Client) streamVertexAnthropic(ctx context.Context, req CompletionRequest, onDelta func(string)) (*CompletionResponse, error) {
	if c.cfg.VertexProject == "" {
		return nil, errors.New("VertexProject not configured")
	}
	location := c.cfg.VertexAnthropicLocation
	if location == "" {
		location = "us-east5"
	}
	model := anthropicModel(req.Model)

	// Vertex-on-Anthropic body intentionally has NO "model" field — the model
	// is in the URL. It DOES need "anthropic_version" set to the Vertex SKU
	// string ("vertex-2023-10-16" at the time of writing). max_tokens is
	// required, same as direct Anthropic.
	body, _ := json.Marshal(map[string]any{
		"anthropic_version": "vertex-2023-10-16",
		"max_tokens":        4096,
		"system":            req.System,
		"messages":          req.Messages,
		"stream":            true,
	})

	url := fmt.Sprintf(
		"https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/anthropic/models/%s:streamRawPredict",
		location, c.cfg.VertexProject, location, model,
	)

	ts, err := c.vertexTokenSource()
	if err != nil {
		return nil, fmt.Errorf("vertex anthropic token source: %w", err)
	}
	tok, err := ts.Token()
	if err != nil {
		return nil, fmt.Errorf("vertex anthropic token: %w", err)
	}

	r, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	r.Header.Set("Authorization", "Bearer "+tok.AccessToken)
	r.Header.Set("content-type", "application/json")

	res, err := c.http.Do(r)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode >= 400 {
		raw, _ := io.ReadAll(res.Body)
		return nil, fmt.Errorf("vertex anthropic stream: %s: %s", res.Status, truncBody(raw))
	}

	var full strings.Builder
	sc := bufio.NewScanner(res.Body)
	// 1 MiB max per SSE line. SSE frames are line-oriented; even a long
	// thinking block arrives as many small lines, not one giant one. The
	// previous 16 MiB cap made a misbehaving provider's no-newline stream
	// a backend-OOM vector multiplied by concurrency.
	sc.Buffer(make([]byte, 0, 64*1024), 1<<20)
	for sc.Scan() {
		line := sc.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		var evt struct {
			Type  string `json:"type"`
			Delta struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"delta"`
		}
		if err := json.Unmarshal([]byte(data), &evt); err != nil {
			continue
		}
		if evt.Type == "content_block_delta" && evt.Delta.Type == "text_delta" && evt.Delta.Text != "" {
			full.WriteString(evt.Delta.Text)
			onDelta(evt.Delta.Text)
		}
	}
	if err := sc.Err(); err != nil {
		return nil, fmt.Errorf("vertex anthropic stream read: %w", err)
	}
	return &CompletionResponse{Provider: "anthropic-vertex", Model: model, Content: full.String()}, nil
}

// streamGoogle calls either Vertex AI streamGenerateContent (when
// VertexProject is set) or AI Studio streamGenerateContent (with API key).
// Vertex returns a streaming JSON array — each chunk decoded as one
// generateContent response. AI Studio's same endpoint returns the same shape.
func (c *Client) streamGoogle(ctx context.Context, req CompletionRequest, onDelta func(string)) (*CompletionResponse, error) {
	if c.cfg.VertexProject == "" && c.cfg.GoogleKey == "" {
		return nil, errors.New("neither GOOGLE_CLOUD_PROJECT (Vertex) nor GOOGLE_API_KEY (AI Studio) configured")
	}

	// Body shape: same as non-streaming.
	parts := []map[string]any{}
	for _, m := range req.Messages {
		role := m.Role
		if role == "assistant" {
			role = "model"
		}
		parts = append(parts, map[string]any{"role": role, "parts": []map[string]string{{"text": m.Content}}})
	}
	body, _ := json.Marshal(map[string]any{
		"contents":          parts,
		"systemInstruction": map[string]any{"parts": []map[string]string{{"text": req.System}}},
	})

	var r *http.Request
	model := "gemini-2.5-pro"
	if c.cfg.VertexProject != "" {
		location := c.cfg.VertexLocation
		if location == "" {
			location = "us-central1"
		}
		// alt=sse asks Vertex to return SSE-framed JSON deltas rather than a
		// streamed JSON array — easier to parse and matches the AI Studio
		// streaming response shape.
		url := fmt.Sprintf(
			"https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/%s:streamGenerateContent?alt=sse",
			location, c.cfg.VertexProject, location, model,
		)
		ts, err := c.vertexTokenSource()
		if err != nil {
			return nil, err
		}
		tok, err := ts.Token()
		if err != nil {
			return nil, fmt.Errorf("vertex token: %w", err)
		}
		r, _ = http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
		r.Header.Set("Authorization", "Bearer "+tok.AccessToken)
	} else {
		url := fmt.Sprintf(
			"https://generativelanguage.googleapis.com/v1beta/models/%s:streamGenerateContent?alt=sse&key=%s",
			model, c.cfg.GoogleKey,
		)
		r, _ = http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	}
	r.Header.Set("content-type", "application/json")

	res, err := c.http.Do(r)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode >= 400 {
		raw, _ := io.ReadAll(res.Body)
		return nil, fmt.Errorf("google stream: %s: %s", res.Status, truncBody(raw))
	}

	var full strings.Builder
	sc := bufio.NewScanner(res.Body)
	// 1 MiB SSE line cap (see other providers in this file).
	sc.Buffer(make([]byte, 0, 64*1024), 1<<20)
	for sc.Scan() {
		line := sc.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		var chunk struct {
			Candidates []struct {
				Content struct {
					Parts []struct{ Text string } `json:"parts"`
				} `json:"content"`
			} `json:"candidates"`
		}
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}
		if len(chunk.Candidates) > 0 {
			for _, p := range chunk.Candidates[0].Content.Parts {
				if p.Text != "" {
					full.WriteString(p.Text)
					onDelta(p.Text)
				}
			}
		}
	}
	if err := sc.Err(); err != nil {
		return nil, fmt.Errorf("google stream read: %w", err)
	}
	return &CompletionResponse{Provider: "google", Model: req.Model, Content: full.String()}, nil
}

// streamOpenAI: vanilla SSE with choices[0].delta.content, terminated by
// "data: [DONE]".
func (c *Client) streamOpenAI(ctx context.Context, req CompletionRequest, onDelta func(string)) (*CompletionResponse, error) {
	if c.cfg.OpenAIKey == "" {
		return nil, errors.New("OPENAI_API_KEY not configured")
	}
	msgs := make([]Message, 0, len(req.Messages)+1)
	if req.System != "" {
		msgs = append(msgs, Message{Role: "system", Content: req.System})
	}
	msgs = append(msgs, req.Messages...)
	body, _ := json.Marshal(map[string]any{"model": req.Model, "messages": msgs, "stream": true})
	r, _ := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/chat/completions", bytes.NewReader(body))
	r.Header.Set("Authorization", "Bearer "+c.cfg.OpenAIKey)
	r.Header.Set("content-type", "application/json")
	res, err := c.http.Do(r)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode >= 400 {
		raw, _ := io.ReadAll(res.Body)
		return nil, fmt.Errorf("openai stream: %s: %s", res.Status, truncBody(raw))
	}

	var full strings.Builder
	sc := bufio.NewScanner(res.Body)
	// 1 MiB max per SSE line. SSE frames are line-oriented; even a long
	// thinking block arrives as many small lines, not one giant one. The
	// previous 16 MiB cap made a misbehaving provider's no-newline stream
	// a backend-OOM vector multiplied by concurrency.
	sc.Buffer(make([]byte, 0, 64*1024), 1<<20)
	for sc.Scan() {
		line := sc.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}
		var chunk struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
		}
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}
		if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Content != "" {
			full.WriteString(chunk.Choices[0].Delta.Content)
			onDelta(chunk.Choices[0].Delta.Content)
		}
	}
	if err := sc.Err(); err != nil {
		return nil, fmt.Errorf("openai stream read: %w", err)
	}
	return &CompletionResponse{Provider: "openai", Model: req.Model, Content: full.String()}, nil
}

func (c *Client) callOpenAI(ctx context.Context, req CompletionRequest) (*CompletionResponse, error) {
	if c.cfg.OpenAIKey == "" {
		return nil, errors.New("OPENAI_API_KEY not configured")
	}
	msgs := make([]Message, 0, len(req.Messages)+1)
	if req.System != "" {
		msgs = append(msgs, Message{Role: "system", Content: req.System})
	}
	msgs = append(msgs, req.Messages...)
	body, _ := json.Marshal(map[string]any{"model": req.Model, "messages": msgs})
	r, _ := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/chat/completions", bytes.NewReader(body))
	r.Header.Set("Authorization", "Bearer "+c.cfg.OpenAIKey)
	r.Header.Set("content-type", "application/json")
	res, err := c.http.Do(r)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("openai: %s: %s", res.Status, truncBody(raw))
	}
	var out struct {
		Choices []struct {
			Message Message `json:"message"`
		} `json:"choices"`
	}
	_ = json.Unmarshal(raw, &out)
	text := ""
	if len(out.Choices) > 0 {
		text = out.Choices[0].Message.Content
	}
	return &CompletionResponse{Provider: "openai", Model: req.Model, Content: text}, nil
}
