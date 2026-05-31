package payments

// Paddle Billing integration (Merchant of Record).
//
// Flow:
//   1. Server creates a transaction:  POST {base}/transactions
//      → returns a transaction id ("txn_…").
//   2. Frontend opens the Paddle.js overlay with that transaction id and the
//      public client-side token; the customer pays inside the overlay.
//   3. Paddle fires a webhook → /api/payments/paddle/webhook, verified via the
//      Paddle-Signature header (HMAC-SHA256 over "<ts>:<rawBody>").
//
// Money flow (configured in the Paddle dashboard, not in code):
//   Customer → pays in Paddle → Paddle collects payment AND handles tax (MoR)
//   → Paddle pays out to the connected bank account (a Wise multi-currency
//   account) → the owner withdraws from Wise to Egypt whenever they want.
//   There is no Wise API in this flow — Wise is purely the payout destination.
//
// Docs: https://developer.paddle.com/

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

type Paddle struct {
	apiKey        string            // server-side API key (Bearer) — secret
	clientToken   string            // public client-side token for Paddle.js
	webhookSecret string            // webhook signing secret
	env           string            // "sandbox" | "production"
	base          string            // API base URL
	prices        map[string]string // plan_id → Paddle price id ("pri_…")
	http          *http.Client
}

// priceEnvByPlan maps each plan id to the env var that holds its Paddle price id.
var priceEnvByPlan = map[string]string{
	"go_monthly":   "PADDLE_PRICE_GO_MONTHLY",
	"plus_monthly": "PADDLE_PRICE_PLUS_MONTHLY",
	"pro_monthly":  "PADDLE_PRICE_PRO_MONTHLY",
	"max_monthly":  "PADDLE_PRICE_MAX_MONTHLY",
}

func NewPaddle() *Paddle {
	env := os.Getenv("PADDLE_ENV")
	if env == "" {
		env = "sandbox"
	}
	base := "https://api.paddle.com"
	if env == "sandbox" {
		base = "https://sandbox-api.paddle.com"
	}
	prices := map[string]string{}
	for planID, envKey := range priceEnvByPlan {
		if v := os.Getenv(envKey); v != "" {
			prices[planID] = v
		}
	}
	return &Paddle{
		apiKey:        os.Getenv("PADDLE_API_KEY"),
		clientToken:   os.Getenv("PADDLE_CLIENT_TOKEN"),
		webhookSecret: os.Getenv("PADDLE_WEBHOOK_SECRET"),
		env:           env,
		base:          base,
		prices:        prices,
		http:          &http.Client{Timeout: 30 * time.Second},
	}
}

// Configured reports whether enough is set to run a real checkout: the server
// API key (to create transactions), the public client token (for Paddle.js),
// and at least one plan price id.
func (p *Paddle) Configured() bool {
	return p.apiKey != "" && p.clientToken != "" && len(p.prices) > 0
}

type PaddleCheckout struct {
	TransactionID string `json:"transaction_id"`
	ClientToken   string `json:"client_token"`
	Environment   string `json:"environment"`
}

// Checkout creates a Paddle transaction for the plan and returns the id the
// frontend needs to open the overlay. user_id + plan_id are stamped into
// custom_data so the webhook can attribute the payment.
func (p *Paddle) Checkout(ctx context.Context, userID, planID string) (*PaddleCheckout, error) {
	if !p.Configured() {
		return nil, errors.New("paddle not configured")
	}
	priceID, ok := p.prices[planID]
	if !ok {
		return nil, errors.New("no price configured for plan")
	}
	if _, ok := GetPlan(planID); !ok {
		return nil, errors.New("unknown plan")
	}
	body, _ := json.Marshal(map[string]any{
		"items":       []map[string]any{{"price_id": priceID, "quantity": 1}},
		"custom_data": map[string]string{"user_id": userID, "plan_id": planID},
	})
	req, err := http.NewRequestWithContext(ctx, "POST", p.base+"/transactions", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+p.apiKey)
	req.Header.Set("content-type", "application/json")
	res, err := p.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("paddle create txn: %s: %s", res.Status, string(raw))
	}
	var out struct {
		Data struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	if out.Data.ID == "" {
		return nil, errors.New("paddle: empty transaction id")
	}
	return &PaddleCheckout{TransactionID: out.Data.ID, ClientToken: p.clientToken, Environment: p.env}, nil
}

// VerifyWebhook validates the Paddle-Signature header. Paddle signs each
// webhook as "ts=<unix>;h1=<hex>", where h1 = HMAC-SHA256( "<ts>:<rawBody>" )
// keyed by the destination's signing secret.
func (p *Paddle) VerifyWebhook(sigHeader string, body []byte) bool {
	if p.webhookSecret == "" || sigHeader == "" {
		return false
	}
	var ts, h1 string
	for _, part := range strings.Split(sigHeader, ";") {
		kv := strings.SplitN(part, "=", 2)
		if len(kv) != 2 {
			continue
		}
		switch strings.TrimSpace(kv[0]) {
		case "ts":
			ts = strings.TrimSpace(kv[1])
		case "h1":
			h1 = strings.TrimSpace(kv[1])
		}
	}
	if ts == "" || h1 == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(p.webhookSecret))
	mac.Write([]byte(ts + ":"))
	mac.Write(body)
	want := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(want), []byte(h1))
}
