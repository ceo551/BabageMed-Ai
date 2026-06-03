package api

// Brave Search — web grounding for the chat composer's "Web search" toggle.
//
// Uses the Brave Search API (LLM-grounding use case): given the user's last
// message we fetch the top web results and hand the model a compact list of
// {title, url, description, snippets} as a "web-search" citation, injected into
// the system prompt the same way MCP results are. The model can then answer
// from — and cite — live web sources.
//
// Auth: header "X-Subscription-Token: <BRAVE_API_KEY>".
// Docs: https://api-dashboard.search.brave.com/app/documentation/web-search

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const braveEndpoint = "https://api.search.brave.com/res/v1/web/search"

var braveHTTP = &http.Client{Timeout: 12 * time.Second}

// BraveResult is one trimmed web hit handed to the model.
type BraveResult struct {
	Title       string   `json:"title"`
	URL         string   `json:"url"`
	Description string   `json:"description"`
	Snippets    []string `json:"extra_snippets,omitempty"`
}

// braveSearch returns the top `count` web results for the query. An empty
// apiKey (BRAVE_API_KEY unset) yields a typed error so the caller can skip web
// search silently rather than surface a failure to the user.
func braveSearch(ctx context.Context, apiKey, query string, count int) ([]BraveResult, error) {
	if apiKey == "" {
		return nil, errors.New("brave not configured")
	}
	query = strings.TrimSpace(query)
	if query == "" {
		return nil, errors.New("empty query")
	}
	if count <= 0 || count > 20 {
		count = 5
	}
	q := url.Values{}
	q.Set("q", query)
	q.Set("count", strconv.Itoa(count))
	q.Set("result_filter", "web")
	q.Set("text_decorations", "false")

	req, err := http.NewRequestWithContext(ctx, "GET", braveEndpoint+"?"+q.Encode(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	// Do NOT set Accept-Encoding manually: when the caller sets it, Go's
	// transport stops transparently decompressing the response and hands back
	// raw gzip bytes, so json.Unmarshal always failed and web search silently
	// returned nothing. Leaving it unset lets the transport gzip + auto-inflate.
	req.Header.Set("X-Subscription-Token", apiKey)

	res, err := braveHTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("brave search: %s: %s", res.Status, string(raw))
	}
	var parsed struct {
		Web struct {
			Results []BraveResult `json:"results"`
		} `json:"web"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, err
	}
	// Trim overly long descriptions so the injected context stays compact.
	for i := range parsed.Web.Results {
		if len(parsed.Web.Results[i].Description) > 600 {
			parsed.Web.Results[i].Description = parsed.Web.Results[i].Description[:600] + "…"
		}
	}
	return parsed.Web.Results, nil
}
