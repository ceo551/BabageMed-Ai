package payments

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"testing"
)

// HMAC verification is the only thing standing between the public
// /api/payments/paymob/webhook endpoint and an attacker forging a
// "paid" event that upgrades any user. These tests pin the canonical
// field order and exercise the obvious tampering surface.

func TestPaymob_VerifyWebhook_HappyPath(t *testing.T) {
	// Build a transaction object with the documented fields and compute
	// the HMAC ourselves; if Paymob's verifier disagrees on field order
	// or concatenation, the test fails loudly.
	p := &Paymob{hmacSecret: "test-secret"}
	obj := paymobTxObj()
	wantHmac := computeHmac(t, "test-secret", obj)
	if !p.VerifyWebhook(wantHmac, obj) {
		t.Fatalf("VerifyWebhook rejected a correctly-signed payload")
	}
}

func TestPaymob_VerifyWebhook_TamperedField(t *testing.T) {
	p := &Paymob{hmacSecret: "test-secret"}
	obj := paymobTxObj()
	good := computeHmac(t, "test-secret", obj)
	// Flip success from true → false; the HMAC stays valid only because
	// we recompute it, so leaving the original HMAC must reject.
	obj["success"] = false
	if p.VerifyWebhook(good, obj) {
		t.Fatalf("VerifyWebhook accepted a tampered payload (success flipped)")
	}
}

func TestPaymob_VerifyWebhook_WrongSecret(t *testing.T) {
	p := &Paymob{hmacSecret: "real-secret"}
	obj := paymobTxObj()
	// HMAC computed with a different key — must reject.
	bad := computeHmac(t, "attacker-secret", obj)
	if p.VerifyWebhook(bad, obj) {
		t.Fatalf("VerifyWebhook accepted a payload signed with the wrong key")
	}
}

func TestPaymob_VerifyWebhook_EmptySecret(t *testing.T) {
	p := &Paymob{hmacSecret: ""}
	obj := paymobTxObj()
	if p.VerifyWebhook("anything", obj) {
		t.Fatalf("VerifyWebhook accepted when hmacSecret is empty — must fail closed")
	}
}

func TestPaymob_VerifyWebhook_EmptyQueryHmac(t *testing.T) {
	p := &Paymob{hmacSecret: "test-secret"}
	if p.VerifyWebhook("", paymobTxObj()) {
		t.Fatalf("VerifyWebhook accepted an empty query-string HMAC")
	}
}

// computeHmac mirrors VerifyWebhook's internal computation so we
// can build expected signatures in tests. This MUST stay in sync with
// the field list inside VerifyWebhook — the HappyPath test would fail
// if it drifted, which is the safety net.
func computeHmac(t *testing.T, secret string, obj map[string]any) string {
	t.Helper()
	fields := []string{
		"amount_cents", "created_at", "currency", "error_occured", "has_parent_transaction",
		"id", "integration_id", "is_3d_secure", "is_auth", "is_capture", "is_refunded",
		"is_standalone_payment", "is_voided", "order.id", "owner", "pending",
		"source_data.pan", "source_data.sub_type", "source_data.type", "success",
	}
	var concat bytes.Buffer
	for _, f := range fields {
		concat.WriteString(lookup(obj, f))
	}
	mac := hmac.New(sha512.New, []byte(secret))
	mac.Write(concat.Bytes())
	return hex.EncodeToString(mac.Sum(nil))
}

func TestPlanFromPlanID(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"pro_monthly", "pro"},
		{"max_monthly", "max"},
		{"max_yearly", "max"},
		{"", "free"},
		{"unknown_garbage", "free"},
		{"PRO_MONTHLY", "free"}, // case-sensitive — verified
	}
	for _, c := range cases {
		got := planFromPlanID(c.in)
		if got != c.want {
			t.Errorf("planFromPlanID(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestGetPlan(t *testing.T) {
	if _, ok := GetPlan("pro_monthly"); !ok {
		t.Fatalf("expected pro_monthly to exist")
	}
	if _, ok := GetPlan(""); ok {
		t.Fatalf("expected empty planID to NOT exist")
	}
	p, _ := GetPlan("pro_monthly")
	if p.EGP <= 0 || p.USD <= 0 {
		t.Fatalf("plan prices must be positive: %+v", p)
	}
	if p.Interval == "" {
		t.Fatalf("plan interval must be set")
	}
}

func paymobTxObj() map[string]any {
	return map[string]any{
		"amount_cents":           float64(250000),
		"created_at":             "2026-05-27T00:00:00Z",
		"currency":               "EGP",
		"error_occured":          false,
		"has_parent_transaction": false,
		"id":                     float64(123456789),
		"integration_id":         float64(98765),
		"is_3d_secure":           true,
		"is_auth":                false,
		"is_capture":             false,
		"is_refunded":            false,
		"is_standalone_payment":  true,
		"is_voided":              false,
		"order": map[string]any{
			"id": float64(987654321),
		},
		"owner":   float64(11111),
		"pending": false,
		"source_data": map[string]any{
			"pan":      "1234",
			"sub_type": "Visa",
			"type":     "card",
		},
		"success": true,
	}
}
