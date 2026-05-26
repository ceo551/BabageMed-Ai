package payments

// PayPal REST integration (Orders v2).
//   POST /v1/oauth2/token        → access token
//   POST /v2/checkout/orders     → order + approval URL
//   POST /v2/checkout/orders/:id/capture
//   Webhook → /api/payments/paypal/webhook (verified via /v1/notifications/verify-webhook-signature)
//
// Docs: https://developer.paypal.com/docs/api/orders/v2/

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"
)

type PayPal struct {
	clientID     string
	clientSecret string
	webhookID    string
	base         string // sandbox or live
	http         *http.Client

	mu    sync.Mutex
	token string
	tExp  time.Time
}

func NewPayPal() *PayPal {
	env := os.Getenv("PAYPAL_ENV")
	base := "https://api-m.paypal.com"
	if env == "" || env == "sandbox" {
		base = "https://api-m.sandbox.paypal.com"
	}
	return &PayPal{
		clientID:     os.Getenv("PAYPAL_CLIENT_ID"),
		clientSecret: os.Getenv("PAYPAL_CLIENT_SECRET"),
		webhookID:    os.Getenv("PAYPAL_WEBHOOK_ID"),
		base:         base,
		http:         &http.Client{Timeout: 30 * time.Second},
	}
}

func (p *PayPal) Configured() bool {
	return p.clientID != "" && p.clientSecret != ""
}

func (p *PayPal) accessToken() (string, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.token != "" && time.Now().Before(p.tExp) {
		return p.token, nil
	}
	creds := base64.StdEncoding.EncodeToString([]byte(p.clientID + ":" + p.clientSecret))
	req, _ := http.NewRequest("POST", p.base+"/v1/oauth2/token", bytes.NewBufferString("grant_type=client_credentials"))
	req.Header.Set("Authorization", "Basic "+creds)
	req.Header.Set("content-type", "application/x-www-form-urlencoded")
	res, err := p.http.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 400 {
		return "", fmt.Errorf("paypal token: %s: %s", res.Status, string(raw))
	}
	var out struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", err
	}
	p.token = out.AccessToken
	p.tExp = time.Now().Add(time.Duration(out.ExpiresIn-60) * time.Second)
	return p.token, nil
}

type PayPalCheckout struct {
	OrderID    string `json:"order_id"`
	ApproveURL string `json:"approve_url"`
}

func (p *PayPal) Checkout(planID, returnURL, cancelURL string) (*PayPalCheckout, error) {
	if !p.Configured() {
		return nil, errors.New("paypal not configured")
	}
	plan, ok := GetPlan(planID)
	if !ok {
		return nil, errors.New("unknown plan")
	}
	tok, err := p.accessToken()
	if err != nil {
		return nil, err
	}
	dollars := strconv.FormatFloat(float64(plan.USD)/100.0, 'f', 2, 64)
	body, _ := json.Marshal(map[string]any{
		"intent": "CAPTURE",
		"purchase_units": []map[string]any{{
			"reference_id": plan.ID,
			"description":  plan.Name + " — Babbage AI",
			"amount":       map[string]string{"currency_code": "USD", "value": dollars},
		}},
		"application_context": map[string]any{
			"brand_name":           "Babbage AI",
			"landing_page":         "NO_PREFERENCE",
			"shipping_preference":  "NO_SHIPPING",
			"user_action":          "PAY_NOW",
			"return_url":           returnURL,
			"cancel_url":           cancelURL,
		},
	})
	req, _ := http.NewRequest("POST", p.base+"/v2/checkout/orders", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+tok)
	req.Header.Set("content-type", "application/json")
	res, err := p.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("paypal create order: %s: %s", res.Status, string(raw))
	}
	var out struct {
		ID    string `json:"id"`
		Links []struct {
			Href, Rel string
		} `json:"links"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	approve := ""
	for _, l := range out.Links {
		if l.Rel == "approve" {
			approve = l.Href
			break
		}
	}
	return &PayPalCheckout{OrderID: out.ID, ApproveURL: approve}, nil
}

// Capture finalises payment after the user approves on PayPal.
func (p *PayPal) Capture(orderID string) (map[string]any, error) {
	tok, err := p.accessToken()
	if err != nil {
		return nil, err
	}
	req, _ := http.NewRequest("POST", p.base+"/v2/checkout/orders/"+orderID+"/capture", bytes.NewReader([]byte("{}")))
	req.Header.Set("Authorization", "Bearer "+tok)
	req.Header.Set("content-type", "application/json")
	res, err := p.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("paypal capture: %s: %s", res.Status, string(raw))
	}
	var out map[string]any
	_ = json.Unmarshal(raw, &out)
	return out, nil
}

// VerifyWebhook calls PayPal's signature-verification endpoint. Returns true on success.
func (p *PayPal) VerifyWebhook(headers http.Header, body []byte) (bool, error) {
	if p.webhookID == "" {
		return false, errors.New("PAYPAL_WEBHOOK_ID not set")
	}
	tok, err := p.accessToken()
	if err != nil {
		return false, err
	}
	var event any
	_ = json.Unmarshal(body, &event)
	req, _ := json.Marshal(map[string]any{
		"transmission_id":   headers.Get("Paypal-Transmission-Id"),
		"transmission_time": headers.Get("Paypal-Transmission-Time"),
		"cert_url":          headers.Get("Paypal-Cert-Url"),
		"auth_algo":         headers.Get("Paypal-Auth-Algo"),
		"transmission_sig":  headers.Get("Paypal-Transmission-Sig"),
		"webhook_id":        p.webhookID,
		"webhook_event":     event,
	})
	r, _ := http.NewRequest("POST", p.base+"/v1/notifications/verify-webhook-signature", bytes.NewReader(req))
	r.Header.Set("Authorization", "Bearer "+tok)
	r.Header.Set("content-type", "application/json")
	res, err := p.http.Do(r)
	if err != nil {
		return false, err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 400 {
		return false, fmt.Errorf("verify: %s: %s", res.Status, string(raw))
	}
	var out struct{ VerificationStatus string `json:"verification_status"` }
	_ = json.Unmarshal(raw, &out)
	return out.VerificationStatus == "SUCCESS", nil
}
