package payments

// Paymob (Accept) integration.
// Flow:
//   1. POST /api/auth/tokens             → auth token
//   2. POST /api/ecommerce/orders        → order id
//   3. POST /api/acceptance/payment_keys → payment_key
//   4. Redirect user to iframe with payment_key
//   5. Webhook → /api/payments/paymob/webhook   (HMAC-verified)
//
// Docs: https://developers.paymob.com/

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"strconv"
	"time"
)

type Paymob struct {
	apiKey       string
	integrationID string
	iframeID     string
	hmacSecret   string
	http         *http.Client
}

func NewPaymob() *Paymob {
	return &Paymob{
		apiKey:        os.Getenv("PAYMOB_API_KEY"),
		integrationID: os.Getenv("PAYMOB_INTEGRATION_ID"),
		iframeID:      os.Getenv("PAYMOB_IFRAME_ID"),
		hmacSecret:    os.Getenv("PAYMOB_HMAC"),
		http:          &http.Client{Timeout: 30 * time.Second},
	}
}

func (p *Paymob) Configured() bool {
	return p.apiKey != "" && p.integrationID != "" && p.iframeID != ""
}

type paymobAuthResp struct {
	Token string `json:"token"`
}

type paymobOrderResp struct {
	ID int64 `json:"id"`
}

type paymobKeyResp struct {
	Token string `json:"token"`
}

type BillingInfo struct {
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Email     string `json:"email"`
	Phone     string `json:"phone_number"`
	Country   string `json:"country"`
	City      string `json:"city"`
}

type PaymobCheckout struct {
	IframeURL string `json:"iframe_url"`
	OrderID   int64  `json:"order_id"`
}

// Checkout creates a full Paymob order and returns the hosted iframe URL.
func (p *Paymob) Checkout(planID string, b BillingInfo) (*PaymobCheckout, error) {
	if !p.Configured() {
		return nil, errors.New("paymob not configured")
	}
	plan, ok := GetPlan(planID)
	if !ok {
		return nil, errors.New("unknown plan")
	}

	// 1. Auth
	auth := &paymobAuthResp{}
	if err := p.post("/api/auth/tokens", map[string]any{"api_key": p.apiKey}, auth, ""); err != nil {
		return nil, fmt.Errorf("paymob auth: %w", err)
	}

	// 2. Order
	order := &paymobOrderResp{}
	if err := p.post("/api/ecommerce/orders", map[string]any{
		"auth_token":      auth.Token,
		"delivery_needed": false,
		"amount_cents":    plan.EGP,
		"currency":        "EGP",
		"items":           []map[string]any{{"name": plan.Name, "amount_cents": plan.EGP, "description": plan.DescriptionEN, "quantity": 1}},
	}, order, ""); err != nil {
		return nil, fmt.Errorf("paymob order: %w", err)
	}

	// 3. Payment key
	if b.FirstName == "" {
		b.FirstName = "Customer"
	}
	if b.LastName == "" {
		b.LastName = "Babagemed"
	}
	if b.Email == "" {
		b.Email = "billing@babagemed.com"
	}
	if b.Phone == "" {
		b.Phone = "NA"
	}
	if b.Country == "" {
		b.Country = "EG"
	}
	if b.City == "" {
		b.City = "Cairo"
	}
	billing := map[string]any{
		"first_name":   b.FirstName,
		"last_name":    b.LastName,
		"email":        b.Email,
		"phone_number": b.Phone,
		"country":      b.Country,
		"city":         b.City,
		"apartment":    "NA", "floor": "NA", "street": "NA", "building": "NA",
		"shipping_method": "NA", "postal_code": "NA", "state": "NA",
	}
	intID, _ := strconv.Atoi(p.integrationID)
	key := &paymobKeyResp{}
	if err := p.post("/api/acceptance/payment_keys", map[string]any{
		"auth_token":     auth.Token,
		"amount_cents":   plan.EGP,
		"expiration":     3600,
		"order_id":       order.ID,
		"billing_data":   billing,
		"currency":       "EGP",
		"integration_id": intID,
	}, key, ""); err != nil {
		return nil, fmt.Errorf("paymob key: %w", err)
	}

	return &PaymobCheckout{
		IframeURL: fmt.Sprintf("https://accept.paymob.com/api/acceptance/iframes/%s?payment_token=%s", p.iframeID, key.Token),
		OrderID:   order.ID,
	}, nil
}

// VerifyWebhook checks Paymob's HMAC (SHA-512 hex) signature against the documented field set.
func (p *Paymob) VerifyWebhook(hmacQuery string, obj map[string]any) bool {
	if p.hmacSecret == "" || hmacQuery == "" {
		return false
	}
	// Per Paymob docs, HMAC is computed on a deterministic concatenation of these
	// fields from the transaction object, in this exact order.
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
	mac := hmac.New(sha512.New, []byte(p.hmacSecret))
	mac.Write(concat.Bytes())
	want := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(want), []byte(hmacQuery))
}

// lookup supports dotted paths like "order.id" against a map[string]any.
func lookup(m map[string]any, path string) string {
	parts := splitDots(path)
	var cur any = m
	for _, p := range parts {
		mp, ok := cur.(map[string]any)
		if !ok {
			return ""
		}
		cur = mp[p]
	}
	if cur == nil {
		return ""
	}
	switch v := cur.(type) {
	case string:
		return v
	case bool:
		if v {
			return "true"
		}
		return "false"
	case float64:
		// avoid scientific notation for integer-ish values
		if v == float64(int64(v)) {
			return strconv.FormatInt(int64(v), 10)
		}
		return strconv.FormatFloat(v, 'f', -1, 64)
	default:
		b, _ := json.Marshal(v)
		return string(b)
	}
}

func splitDots(s string) []string {
	out := []string{}
	last := 0
	for i, r := range s {
		if r == '.' {
			out = append(out, s[last:i])
			last = i + 1
		}
	}
	out = append(out, s[last:])
	return out
}

// keepSorted ensures deterministic iteration when needed elsewhere.
func keepSorted(in []string) []string {
	out := append([]string(nil), in...)
	sort.Strings(out)
	return out
}

func (p *Paymob) post(path string, body any, out any, bearer string) error {
	buf, _ := json.Marshal(body)
	req, _ := http.NewRequest("POST", "https://accept.paymob.com"+path, bytes.NewReader(buf))
	req.Header.Set("content-type", "application/json")
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	res, err := p.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 400 {
		return fmt.Errorf("paymob %s: %s: %s", path, res.Status, string(raw))
	}
	if out != nil {
		return json.Unmarshal(raw, out)
	}
	return nil
}

// silence unused-import warnings if keepSorted ends up unused.
var _ = keepSorted
