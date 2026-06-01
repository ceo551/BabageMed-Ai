package mfa

import (
	"testing"
	"time"
)

// RFC 6238 Appendix B publishes canonical TOTP outputs for the test
// secret "12345678901234567890" (ASCII). We use the SHA1 row.
func TestGenerateCode_RFC6238Vectors(t *testing.T) {
	// Base32("12345678901234567890") = GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ
	const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
	// (unix-time, expected-6-digit-code) from RFC 6238 §B (truncated
	// to first 6 chars of the published 8-digit values).
	cases := []struct {
		ts   int64
		want string
	}{
		{59, "287082"},
		{1111111109, "081804"},
		{1111111111, "050471"},
		{1234567890, "005924"},
		{2000000000, "279037"},
	}
	for _, c := range cases {
		got, err := GenerateCode(secret, time.Unix(c.ts, 0))
		if err != nil {
			t.Fatalf("GenerateCode err: %v", err)
		}
		if got != c.want {
			t.Errorf("ts=%d: got %q, want %q", c.ts, got, c.want)
		}
	}
}

func TestVerify_AcceptsDrift(t *testing.T) {
	const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
	now := time.Unix(1111111109, 0)
	correct, _ := GenerateCode(secret, now)
	// Exact match.
	if !Verify(secret, correct, now) {
		t.Error("exact-window verify failed")
	}
	// 25 seconds in the past — still inside the ±1 window.
	if !Verify(secret, correct, now.Add(25*time.Second)) {
		t.Error("drift +25s rejected (should accept ±30s)")
	}
	// 90 seconds in the future — outside the window, must fail.
	if Verify(secret, correct, now.Add(90*time.Second)) {
		t.Error("drift +90s accepted (should reject; outside ±30s)")
	}
}

func TestVerify_RejectsGarbage(t *testing.T) {
	const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
	now := time.Unix(1111111109, 0)
	for _, bad := range []string{"", "abc", "12345", "1234567", "  ", "999999"} {
		if Verify(secret, bad, now) {
			t.Errorf("Verify accepted bogus code %q", bad)
		}
	}
}

func TestEncodeDecodeBase32Roundtrip(t *testing.T) {
	raw := []byte("any-secret-bytes-32")
	enc := EncodeSecretBase32(raw)
	dec, err := decodeBase32(enc)
	if err != nil {
		t.Fatal(err)
	}
	if string(dec) != string(raw) {
		t.Errorf("roundtrip mismatch: %q vs %q", dec, raw)
	}
	// Authenticator apps tolerate space-separated / lowercase input;
	// our decoder must too.
	spaced := "g ez dg nbv gy 3t qojq gezdgnbvgy3tqojq"
	if _, err := decodeBase32(spaced); err != nil {
		t.Errorf("spaced/lowercase base32 rejected: %v", err)
	}
}

func TestOtpauthURI_FormatsForAuthenticatorApps(t *testing.T) {
	u := OtpauthURI("Pervagans", "user@example.com", "JBSWY3DPEHPK3PXP")
	// Smoke check — Google Authenticator parses any URI that starts
	// with otpauth://totp/, has a secret= query, and an issuer=.
	for _, want := range []string{"otpauth://totp/", "secret=JBSWY3DPEHPK3PXP", "issuer=Pervagans+Space", "algorithm=SHA1", "digits=6", "period=30"} {
		if !contains(u, want) {
			t.Errorf("OtpauthURI missing %q: %s", want, u)
		}
	}
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
