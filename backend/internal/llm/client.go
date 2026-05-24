package llm

import (
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
	OpenAIKey      string
}

type Client struct {
	cfg  Config
	http *http.Client
	// Vertex AI access tokens are valid for ~1h; cache + refresh through the
	// google.FindDefaultCredentials TokenSource (which itself handles the
	// federated-token → impersonation dance).
	gcpTSOnce sync.Once
	gcpTS     oauth2.TokenSource
	gcpTSErr  error
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
	c.gcpTSOnce.Do(func() {
		creds, err := google.FindDefaultCredentials(context.Background(), "https://www.googleapis.com/auth/cloud-platform")
		if err != nil {
			c.gcpTSErr = fmt.Errorf("ADC: %w", err)
			return
		}
		c.gcpTS = creds.TokenSource
	})
	return c.gcpTS, c.gcpTSErr
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

// Complete picks a provider by model id prefix.
func (c *Client) Complete(ctx context.Context, req CompletionRequest) (*CompletionResponse, error) {
	start := time.Now()
	provider := "anthropic"
	var out *CompletionResponse
	var err error
	switch {
	case strings.HasPrefix(req.Model, "opus") || strings.HasPrefix(req.Model, "claude") || strings.HasPrefix(req.Model, "sonnet") || strings.HasPrefix(req.Model, "haiku"):
		provider = "anthropic"
		out, err = c.callAnthropic(ctx, req)
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
	modelMap := map[string]string{
		"opus-4.7":  "claude-opus-4-7",
		"opus-4.6":  "claude-opus-4-6",
		"sonnet":    "claude-sonnet-4-6",
		"haiku":     "claude-haiku-4-5",
	}
	m, ok := modelMap[req.Model]
	if !ok {
		m = "claude-opus-4-7"
	}
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
		return nil, fmt.Errorf("anthropic: %s: %s", res.Status, string(raw))
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
		return nil, fmt.Errorf("google: %s: %s", res.Status, string(raw))
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
		return nil, fmt.Errorf("openai: %s: %s", res.Status, string(raw))
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
