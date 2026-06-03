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
)

// DashScope (Alibaba Cloud Model Studio) integration.
//
// One API key (DASHSCOPE_API_KEY) drives three modalities against the
// Singapore / international endpoint by default:
//
//   - text  → OpenAI-compatible  /compatible-mode/v1/chat/completions  (streaming)
//             models: qwen3.7-max, glm-5.1, deepseek-v4-pro …
//   - image → native             /api/v1/services/aigc/multimodal-generation/generation
//             SYNCHRONOUS — the rendered image URL comes back in the response body.
//             models: qwen-image-2.0-pro, wan2.7-image-pro
//   - video → native             /api/v1/services/aigc/video-generation/video-synthesis
//             ASYNCHRONOUS — returns a task_id; poll /api/v1/tasks/{id} until
//             task_status == SUCCEEDED, then read output.video_url.
//             models: happyhorse-1.0-t2v
//
// Base URL defaults to https://dashscope-intl.aliyuncs.com (the region the
// Model Studio account lives in — Singapore). Override via DASHSCOPE_BASE_URL
// (e.g. the Beijing endpoint https://dashscope.aliyuncs.com for a CN account).
// The endpoint paths + model codes were validated live against the account's
// /models list before wiring; see dashScope*ModelMap below.

const dashScopeDefaultBase = "https://dashscope-intl.aliyuncs.com"

func (c *Client) dashScopeBase() string {
	if c.cfg.DashScopeBaseURL != "" {
		return strings.TrimRight(c.cfg.DashScopeBaseURL, "/")
	}
	return dashScopeDefaultBase
}

// validTaskID guards the async-video task id before it is interpolated into the
// upstream /api/v1/tasks/{id} URL — a URL that carries the org's DASHSCOPE
// bearer token. Without this, a crafted id (slashes, ?, CRLF) becomes
// path/query injection against the upstream API, and a malformed value made
// http.NewRequest fail → nil request → panic on r.Header.Set. DashScope ids are
// uuid-ish; restrict to a safe charset and length.
func validTaskID(s string) bool {
	if len(s) == 0 || len(s) > 64 {
		return false
	}
	for i := 0; i < len(s); i++ {
		c := s[i]
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '-' || c == '_') {
			return false
		}
	}
	return true
}

// dashScopeModelMap maps UI picker ids (apps/web/app/lib/models.ts) to the real
// Model Studio text model codes. Unknown ids pass through verbatim so a power
// user can target a freshly released code without a backend redeploy.
var dashScopeModelMap = map[string]string{
	"qwen-3.7-max":    "qwen3.7-max",
	"glm-5.1":         "glm-5.1",
	"deepseek-v4-pro": "deepseek-v4-pro",
}

// dashScopeImageModelMap / dashScopeVideoModelMap map the visual picker ids to
// Model Studio media codes (image is direct, video is the t2v variant).
var dashScopeImageModelMap = map[string]string{
	"qwen-image-2.0-pro": "qwen-image-2.0-pro",
	"wan2.7-image-pro":   "wan2.7-image-pro",
}
var dashScopeVideoModelMap = map[string]string{
	"happy-horse-1.0": "happyhorse-1.0-t2v",
}

func dashScopeModel(id string) string {
	if m, ok := dashScopeModelMap[id]; ok {
		return m
	}
	return id
}
func dashScopeImageModel(id string) string {
	if m, ok := dashScopeImageModelMap[id]; ok {
		return m
	}
	return id
}
func dashScopeVideoModel(id string) string {
	if m, ok := dashScopeVideoModelMap[id]; ok {
		return m
	}
	return id
}

// dashScopeMessages converts the request into the OpenAI-compatible message
// list (system prompt prepended). Shared by the streaming + non-streaming
// text paths.
func dashScopeMessages(req CompletionRequest) []Message {
	msgs := make([]Message, 0, len(req.Messages)+1)
	if req.System != "" {
		msgs = append(msgs, Message{Role: "system", Content: req.System})
	}
	return append(msgs, req.Messages...)
}

// streamDashScope speaks the OpenAI-compatible streaming protocol
// (choices[0].delta.content, terminated by "data: [DONE]"). Reasoning models
// (qwen3.x, glm) also emit a delta.reasoning_content field during their
// thinking phase — we intentionally ignore it and stream only the final
// answer content, matching the other providers' behaviour.
func (c *Client) streamDashScope(ctx context.Context, req CompletionRequest, onDelta func(string)) (*CompletionResponse, error) {
	if c.cfg.DashScopeKey == "" {
		return nil, errors.New("DASHSCOPE_API_KEY not configured")
	}
	model := dashScopeModel(req.Model)
	body, _ := json.Marshal(map[string]any{
		"model":    model,
		"messages": dashScopeMessages(req),
		"stream":   true,
	})
	url := c.dashScopeBase() + "/compatible-mode/v1/chat/completions"
	r, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	r.Header.Set("Authorization", "Bearer "+c.cfg.DashScopeKey)
	r.Header.Set("content-type", "application/json")
	res, err := c.httpStream.Do(r)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode >= 400 {
		raw, _ := io.ReadAll(res.Body)
		return nil, fmt.Errorf("dashscope stream: %s: %s", res.Status, truncBody(raw))
	}

	var full strings.Builder
	sc := bufio.NewScanner(res.Body)
	// 1 MiB per-line cap, same OOM-defence as the other SSE parsers in client.go.
	sc.Buffer(make([]byte, 0, 64*1024), 1<<20)
	for sc.Scan() {
		line := sc.Text()
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
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
		return nil, fmt.Errorf("dashscope stream read: %w", err)
	}
	return &CompletionResponse{Provider: "dashscope", Model: model, Content: full.String()}, nil
}

// callDashScope is the non-streaming twin used by Complete().
func (c *Client) callDashScope(ctx context.Context, req CompletionRequest) (*CompletionResponse, error) {
	if c.cfg.DashScopeKey == "" {
		return nil, errors.New("DASHSCOPE_API_KEY not configured")
	}
	model := dashScopeModel(req.Model)
	body, _ := json.Marshal(map[string]any{"model": model, "messages": dashScopeMessages(req)})
	url := c.dashScopeBase() + "/compatible-mode/v1/chat/completions"
	r, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	r.Header.Set("Authorization", "Bearer "+c.cfg.DashScopeKey)
	r.Header.Set("content-type", "application/json")
	res, err := c.http.Do(r)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("dashscope: %s: %s", res.Status, truncBody(raw))
	}
	var out struct {
		Choices []struct {
			Message Message `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, fmt.Errorf("dashscope: decode response: %w", err)
	}
	text := ""
	if len(out.Choices) > 0 {
		text = out.Choices[0].Message.Content
	}
	return &CompletionResponse{Provider: "dashscope", Model: model, Content: text}, nil
}

// ─── Image (synchronous) ────────────────────────────────────────────────────

// ImageOptions are the user-tunable generation controls. Zero values mean
// "model default": Seed 0 = random, empty Size = 1024*1024, N <= 0 = 1.
type ImageOptions struct {
	NegativePrompt string
	Size           string // "<w>*<h>", e.g. "1280*720"
	Seed           int
	N              int // batch count (clamped 1..4 by the caller)
}

// GenerateImage renders 1..N images from a prompt and returns EVERY result URL.
// The multimodal-generation endpoint is synchronous (~10-30 s, within the 120 s
// non-stream client timeout) and accepts negative_prompt / seed / n / size
// (validated live). modelID is a UI picker id.
func (c *Client) GenerateImage(ctx context.Context, modelID, prompt string, opts ImageOptions) ([]string, error) {
	if c.cfg.DashScopeKey == "" {
		return nil, errors.New("DASHSCOPE_API_KEY not configured")
	}
	model := dashScopeImageModel(modelID)
	size := opts.Size
	if size == "" {
		size = "1024*1024"
	}
	params := map[string]any{"size": size}
	if strings.TrimSpace(opts.NegativePrompt) != "" {
		params["negative_prompt"] = opts.NegativePrompt
	}
	if opts.Seed > 0 {
		params["seed"] = opts.Seed
	}
	if opts.N >= 1 {
		params["n"] = opts.N
	}
	body, _ := json.Marshal(map[string]any{
		"model": model,
		"input": map[string]any{
			"messages": []map[string]any{
				{"role": "user", "content": []map[string]any{{"text": prompt}}},
			},
		},
		"parameters": params,
	})
	url := c.dashScopeBase() + "/api/v1/services/aigc/multimodal-generation/generation"
	r, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	r.Header.Set("Authorization", "Bearer "+c.cfg.DashScopeKey)
	r.Header.Set("content-type", "application/json")
	res, err := c.http.Do(r)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("dashscope image: %s: %s", res.Status, truncBody(raw))
	}
	var out struct {
		Output struct {
			Choices []struct {
				Message struct {
					Content []struct {
						Image string `json:"image"`
					} `json:"content"`
				} `json:"message"`
			} `json:"choices"`
		} `json:"output"`
		Code    string `json:"code"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, fmt.Errorf("dashscope image: decode: %w", err)
	}
	// DashScope returns 200 with a top-level code/message on logical failures.
	if out.Code != "" {
		return nil, fmt.Errorf("dashscope image: %s: %s", out.Code, out.Message)
	}
	var urls []string
	for _, ch := range out.Output.Choices {
		for _, part := range ch.Message.Content {
			if part.Image != "" {
				urls = append(urls, part.Image)
			}
		}
	}
	if len(urls) == 0 {
		return nil, errors.New("dashscope image: no image in response")
	}
	return urls, nil
}

// ─── Video (async + poll) ───────────────────────────────────────────────────

// VideoTask is the polled state of an async video-synthesis job.
type VideoTask struct {
	Status string // PENDING / RUNNING / SUCCEEDED / FAILED / UNKNOWN
	URL    string // populated only when Status == SUCCEEDED
}

// VideoOptions are the user-tunable video controls (empty Size = 1280*720).
type VideoOptions struct {
	Size string // "<w>*<h>", e.g. "1280*720" (16:9), "720*1280" (9:16)
}

// SubmitVideo kicks off an async text-to-video job and returns its task id.
// The X-DashScope-Async header is REQUIRED — without it the endpoint 400s with
// a confusing "url error". The caller polls PollVideo until the task finishes.
func (c *Client) SubmitVideo(ctx context.Context, modelID, prompt string, opts VideoOptions) (string, error) {
	if c.cfg.DashScopeKey == "" {
		return "", errors.New("DASHSCOPE_API_KEY not configured")
	}
	model := dashScopeVideoModel(modelID)
	size := opts.Size
	if size == "" {
		size = "1280*720"
	}
	body, _ := json.Marshal(map[string]any{
		"model":      model,
		"input":      map[string]any{"prompt": prompt},
		"parameters": map[string]any{"size": size},
	})
	url := c.dashScopeBase() + "/api/v1/services/aigc/video-generation/video-synthesis"
	r, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	r.Header.Set("Authorization", "Bearer "+c.cfg.DashScopeKey)
	r.Header.Set("content-type", "application/json")
	r.Header.Set("X-DashScope-Async", "enable")
	res, err := c.http.Do(r)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 400 {
		return "", fmt.Errorf("dashscope video submit: %s: %s", res.Status, truncBody(raw))
	}
	var out struct {
		Output struct {
			TaskID string `json:"task_id"`
		} `json:"output"`
		Code    string `json:"code"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", fmt.Errorf("dashscope video submit: decode: %w", err)
	}
	if out.Code != "" {
		return "", fmt.Errorf("dashscope video submit: %s: %s", out.Code, out.Message)
	}
	if out.Output.TaskID == "" {
		return "", errors.New("dashscope video submit: no task_id in response")
	}
	return out.Output.TaskID, nil
}

// PollVideo fetches the current state of an async video task. The frontend
// polls this until Status is SUCCEEDED (URL ready) or FAILED.
func (c *Client) PollVideo(ctx context.Context, taskID string) (VideoTask, error) {
	if c.cfg.DashScopeKey == "" {
		return VideoTask{}, errors.New("DASHSCOPE_API_KEY not configured")
	}
	if !validTaskID(taskID) {
		return VideoTask{}, errors.New("dashscope video poll: invalid task id")
	}
	url := c.dashScopeBase() + "/api/v1/tasks/" + taskID
	r, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return VideoTask{}, err
	}
	r.Header.Set("Authorization", "Bearer "+c.cfg.DashScopeKey)
	res, err := c.http.Do(r)
	if err != nil {
		return VideoTask{}, err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 400 {
		return VideoTask{}, fmt.Errorf("dashscope video poll: %s: %s", res.Status, truncBody(raw))
	}
	var out struct {
		Output struct {
			TaskStatus string `json:"task_status"`
			VideoURL   string `json:"video_url"`
		} `json:"output"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return VideoTask{}, fmt.Errorf("dashscope video poll: decode: %w", err)
	}
	return VideoTask{Status: out.Output.TaskStatus, URL: out.Output.VideoURL}, nil
}
