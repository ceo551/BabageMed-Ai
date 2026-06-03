package ratelimit

import (
	"net/http/httptest"
	"testing"
	"time"
)

func TestAllowBurstThenThrottle(t *testing.T) {
	b := New(3, time.Hour)
	// First three calls are inside the burst budget.
	for i := 0; i < 3; i++ {
		if !b.Allow("k") {
			t.Fatalf("burst call %d unexpectedly denied", i+1)
		}
	}
	// 4th call must be denied; refill is an hour away.
	if b.Allow("k") {
		t.Fatal("4th call should be denied after burst exhausted")
	}
}

func TestRefillAddsTokens(t *testing.T) {
	b := New(2, 10*time.Millisecond)
	b.Allow("k")
	b.Allow("k")
	if b.Allow("k") {
		t.Fatal("3rd call should fail before refill")
	}
	time.Sleep(35 * time.Millisecond)
	if !b.Allow("k") {
		t.Fatal("after refill, next call should succeed")
	}
}

func TestKeysAreIndependent(t *testing.T) {
	b := New(1, time.Hour)
	if !b.Allow("a") {
		t.Fatal("first call for 'a' must succeed")
	}
	if b.Allow("a") {
		t.Fatal("second call for 'a' must fail (capacity=1)")
	}
	// Different key has its own bucket.
	if !b.Allow("b") {
		t.Fatal("first call for 'b' must succeed (independent bucket)")
	}
}

func TestClientIPTrustsClientIPHeaderNotXFF(t *testing.T) {
	r := httptest.NewRequest("GET", "/", nil)
	// Attacker-controlled XFF must be ignored; only the proxy-set X-Client-IP
	// is trusted (else every request shares one bucket / can be spoofed).
	r.Header.Set("X-Forwarded-For", "203.0.113.5, 10.0.0.1, 172.16.0.1")
	r.Header.Set("X-Client-IP", "198.51.100.9")
	if got := clientIP(r); got != "198.51.100.9" {
		t.Errorf("clientIP = %q, want 198.51.100.9 (X-Client-IP, not XFF)", got)
	}
}

func TestClientIPFromRemoteAddr(t *testing.T) {
	r := httptest.NewRequest("GET", "/", nil)
	r.RemoteAddr = "10.0.0.7:54321"
	if got := clientIP(r); got != "10.0.0.7" {
		t.Errorf("clientIP = %q, want 10.0.0.7", got)
	}
}
