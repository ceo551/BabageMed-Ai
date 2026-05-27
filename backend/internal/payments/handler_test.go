package payments

import "testing"

// PayPal return_url / cancel_url MUST stay on our own origin — without
// this guard, an attacker can craft a checkout link with a return_url
// pointing at a phishing page and the user trusts the post-checkout
// redirect because PayPal honoured it.
func TestIsAllowedReturn(t *testing.T) {
	const base = "https://app.babagemed.com"
	cases := []struct {
		raw  string
		want bool
	}{
		{base + "/billing/return", true},
		{base + "/billing/cancel", true},
		{base + "/x/y?z=1", true},
		// Subtle: a URL that merely starts with the base host but on a
		// different domain (typosquat) must fail.
		{"https://app.babagemed.com.evil.com/billing/return", false},
		// Different scheme.
		{"http://app.babagemed.com/billing/return", false},
		// Wrong host entirely.
		{"https://evil.com/billing/return", false},
		// Empty / nonsense.
		{"", false},
		{"javascript:alert(1)", false},
		{"/billing/return", false}, // path-only (no origin) — reject
	}
	for _, c := range cases {
		got := isAllowedReturn(c.raw, base)
		if got != c.want {
			t.Errorf("isAllowedReturn(%q, %q) = %v, want %v", c.raw, base, got, c.want)
		}
	}
	// Empty publicBase → everything must be rejected so a misconfigured
	// deploy can't silently allow open redirects.
	for _, raw := range []string{"https://app.babagemed.com/", "anything"} {
		if isAllowedReturn(raw, "") {
			t.Errorf("isAllowedReturn(%q, \"\") = true, want false (empty base must reject)", raw)
		}
	}
}
