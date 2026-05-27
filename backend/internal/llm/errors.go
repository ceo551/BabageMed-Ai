package llm

// truncBody caps an upstream error body for inclusion in a Go error
// message. Without this we were echoing the full upstream response
// verbatim — which on Anthropic / Google can include the system prompt
// (containing user-side instructions and Space context like file
// contents) and on OAuth endpoints can include the token request, both
// of which would then leak to the HTTP client when the error is
// formatted into a 502 response body.
//
// The full body still ends up in stdout via chi's middleware.Logger,
// where it's visible to operators but not to end users.
func truncBody(raw []byte) string {
	const max = 200
	if len(raw) > max {
		return string(raw[:max]) + "…"
	}
	return string(raw)
}
