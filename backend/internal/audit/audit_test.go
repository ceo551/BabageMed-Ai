package audit

import (
	"net/http/httptest"
	"testing"
)

// XFF parsing — leftmost claim wins because our trusted ingress
// overwrites the header on entry. If the ingress ever stops doing
// that, switch to the rightmost element.
func TestClientIPFromRequest_XFFLeftmost(t *testing.T) {
	r := httptest.NewRequest("GET", "/", nil)
	r.Header.Set("X-Forwarded-For", "203.0.113.5, 10.0.0.1, 172.16.0.1")
	if got := clientIPFromRequest(r); got != "203.0.113.5" {
		t.Errorf("XFF leftmost = %q, want 203.0.113.5", got)
	}
}

func TestClientIPFromRequest_FallbackToRemoteAddr(t *testing.T) {
	r := httptest.NewRequest("GET", "/", nil)
	r.RemoteAddr = "10.0.0.7:54321"
	if got := clientIPFromRequest(r); got != "10.0.0.7" {
		t.Errorf("RemoteAddr fallback = %q, want 10.0.0.7", got)
	}
}

func TestTrimSpace(t *testing.T) {
	cases := []struct{ in, want string }{
		{"  hello  ", "hello"},
		{"\t\there\t\t", "here"},
		{"no-trim", "no-trim"},
		{"", ""},
	}
	for _, c := range cases {
		if got := trimSpace(c.in); got != c.want {
			t.Errorf("trimSpace(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

// Record() must be fully nil-tolerant — a nil service (no DB wired)
// should silently no-op rather than panic. Otherwise an admin handler
// would crash whenever the audit subsystem is misconfigured, which is
// the opposite of fire-and-forget.
func TestRecord_NilServiceNoPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("nil service panicked: %v", r)
		}
	}()
	var s *Service
	r := httptest.NewRequest("POST", "/x", nil)
	s.Record(r.Context(), r, "u", "t", "test.action", map[string]any{"k": "v"})
}
