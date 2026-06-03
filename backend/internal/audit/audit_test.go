package audit

import (
	"net/http/httptest"
	"testing"
)

// Only the proxy-set X-Client-IP is trusted; a client-supplied
// X-Forwarded-For must be ignored so audit source IPs can't be forged.
func TestClientIPFromRequest_TrustsClientIPHeaderNotXFF(t *testing.T) {
	r := httptest.NewRequest("GET", "/", nil)
	r.Header.Set("X-Forwarded-For", "203.0.113.5, 10.0.0.1") // attacker-controlled — ignored
	r.Header.Set("X-Client-IP", "198.51.100.9")              // proxy-set — trusted
	if got := clientIPFromRequest(r); got != "198.51.100.9" {
		t.Errorf("clientIP = %q, want 198.51.100.9 (X-Client-IP, not XFF)", got)
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
