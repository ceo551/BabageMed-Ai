package payments

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/babagemed/backend/internal/auth"
	"github.com/go-chi/chi/v5"
)

// errBadBody is matched by handlers that want to surface a 400 instead of a 401
// when the request body itself can't be parsed.
var errBadBody = errors.New("bad webhook body")

// Required is the subset of *auth.Service we depend on; declared as an
// interface so test handlers don't need a full Service.
type Required interface {
	Required(http.Handler) http.Handler
}

type Handler struct {
	pm      *Paymob
	pp      *PayPal
	store   *Store   // nil if DB not configured — webhooks still verify, just don't persist
	authSvc Required // nil → checkout endpoints stay anonymous
}

func NewHandler() *Handler {
	return &Handler{pm: NewPaymob(), pp: NewPayPal()}
}

// WithStore wires DB-backed persistence into the handler.
func (h *Handler) WithStore(s *Store) *Handler {
	h.store = s
	return h
}

// WithAuth gates checkout/capture behind a real user session. Webhooks
// stay unauthenticated (they're verified by HMAC / PayPal signature
// instead) because the upstream call comes from the payment provider,
// not the user's browser.
func (h *Handler) WithAuth(a Required) *Handler {
	h.authSvc = a
	return h
}

func (h *Handler) Register(r chi.Router) {
	r.Get("/api/payments/plans", h.ListPlans)
	r.Get("/api/payments/providers", h.Providers)

	gated := func(p string, f http.HandlerFunc) {
		if h.authSvc != nil {
			r.With(h.authSvc.Required).Post(p, f)
		} else {
			r.Post(p, f)
		}
	}
	gated("/api/payments/paymob/checkout", h.PaymobCheckout)
	gated("/api/payments/paypal/checkout", h.PayPalCheckout)
	gated("/api/payments/paypal/capture", h.PayPalCapture)

	// Webhooks are signature-verified, not session-verified.
	r.Post("/api/payments/paymob/webhook", h.PaymobWebhook)
	r.Post("/api/payments/paypal/webhook", h.PayPalWebhook)
}

// ─── Discovery ─────────────────────────────────────────────────────────────

func (h *Handler) ListPlans(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, map[string]any{"plans": ListPlans()})
}

func (h *Handler) Providers(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, map[string]any{
		"paymob": h.pm.Configured(),
		"paypal": h.pp.Configured(),
	})
}

// ─── Paymob ────────────────────────────────────────────────────────────────

type paymobReq struct {
	PlanID  string      `json:"plan_id"`
	Billing BillingInfo `json:"billing"`
}

func (h *Handler) PaymobCheckout(w http.ResponseWriter, r *http.Request) {
	var b paymobReq
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		http.Error(w, "invalid json", 400)
		return
	}
	out, err := h.pm.Checkout(r.Context(), b.PlanID, b.Billing)
	if err != nil {
		writeJSON(w, 502, map[string]string{"error": err.Error()})
		return
	}
	if h.store != nil {
		var uid *string
		if u := auth.FromContext(r.Context()); u != nil {
			uid = &u.ID
		}
		plan, _ := GetPlan(b.PlanID)
		_ = h.store.Record(r.Context(), uid, "paymob", strconv.FormatInt(out.OrderID, 10), b.PlanID, plan.EGP, "EGP", "pending", nil)
	}
	writeJSON(w, 200, out)
}

func (h *Handler) PaymobWebhook(w http.ResponseWriter, r *http.Request) {
	hmacQ := r.URL.Query().Get("hmac")
	body, _ := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	var env struct {
		Type string         `json:"type"`
		Obj  map[string]any `json:"obj"`
	}
	if err := json.Unmarshal(body, &env); err != nil {
		http.Error(w, "invalid", 400)
		return
	}
	if !h.pm.VerifyWebhook(hmacQ, env.Obj) {
		http.Error(w, "bad hmac", 401)
		return
	}
	if env.Type == "TRANSACTION" {
		success, _ := env.Obj["success"].(bool)
		if h.store != nil {
			orderID := ""
			if o, ok := env.Obj["order"].(map[string]any); ok {
				if id, ok := o["id"].(float64); ok {
					orderID = strconv.FormatInt(int64(id), 10)
				}
			}
			status := "failed"
			if success {
				status = "paid"
			}
			_ = h.store.Record(r.Context(), nil, "paymob", orderID, "", 0, "EGP", status, env.Obj)
			if success {
				_ = h.store.MarkPaid(r.Context(), "paymob", orderID, "")
			}
		}
		writeJSON(w, 200, map[string]any{"ok": true, "success": success})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

// ─── PayPal ────────────────────────────────────────────────────────────────

type paypalReq struct {
	PlanID    string `json:"plan_id"`
	ReturnURL string `json:"return_url"`
	CancelURL string `json:"cancel_url"`
}

func (h *Handler) PayPalCheckout(w http.ResponseWriter, r *http.Request) {
	var b paypalReq
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		http.Error(w, "invalid json", 400)
		return
	}
	if b.ReturnURL == "" {
		b.ReturnURL = os.Getenv("PUBLIC_BASE_URL") + "/billing/return"
	}
	if b.CancelURL == "" {
		b.CancelURL = os.Getenv("PUBLIC_BASE_URL") + "/billing/cancel"
	}
	out, err := h.pp.Checkout(r.Context(), b.PlanID, b.ReturnURL, b.CancelURL)
	if err != nil {
		writeJSON(w, 502, map[string]string{"error": err.Error()})
		return
	}
	if h.store != nil {
		var uid *string
		if u := auth.FromContext(r.Context()); u != nil {
			uid = &u.ID
		}
		plan, _ := GetPlan(b.PlanID)
		_ = h.store.Record(r.Context(), uid, "paypal", out.OrderID, b.PlanID, plan.USD, "USD", "pending", nil)
	}
	writeJSON(w, 200, out)
}

func (h *Handler) PayPalCapture(w http.ResponseWriter, r *http.Request) {
	var b struct {
		OrderID string `json:"order_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || b.OrderID == "" {
		http.Error(w, "order_id required", 400)
		return
	}
	out, err := h.pp.Capture(r.Context(), b.OrderID)
	if err != nil {
		writeJSON(w, 502, map[string]string{"error": err.Error()})
		return
	}
	if h.store != nil {
		_ = h.store.MarkPaid(r.Context(), "paypal", b.OrderID, "")
	}
	writeJSON(w, 200, out)
}

func (h *Handler) PayPalWebhook(w http.ResponseWriter, r *http.Request) {
	// Cap body so a malicious request can't OOM the process. PayPal webhook
	// events are typically <2 KB; 1 MiB is generously above any real payload.
	body, _ := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	// Use a fresh ctx with a generous timeout for the verifier so a
	// client disconnect doesn't make us false-negative the signature.
	// PayPal retries 401s for ~3 days, so a transient ctx cancellation
	// here would otherwise trigger days of retry storms.
	verifyCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	ok, err := h.pp.VerifyWebhook(verifyCtx, r.Header, body)
	if err != nil {
		// A bad-body error (failed JSON parse) is the caller's fault →
		// 400, not 401, so the upstream PayPal retry logic doesn't loop
		// against a malformed message we'd never accept.
		if errors.Is(err, errBadBody) || strings.HasPrefix(err.Error(), "bad webhook body") {
			writeJSON(w, 400, map[string]string{"error": err.Error()})
			return
		}
		// Verifier UNREACHABLE (network, expired client token, PayPal
		// outage) — return 503 so PayPal's retry loop applies back-
		// pressure instead of treating it as a hard signature failure
		// (which would burn through their ~25-attempt budget in hours).
		writeJSON(w, 503, map[string]string{"error": "verifier unavailable"})
		return
	}
	if !ok {
		http.Error(w, "verification failed", 401)
		return
	}
	if h.store != nil {
		var env struct {
			EventType string `json:"event_type"`
			Resource  struct {
				ID                  string `json:"id"`
				SupplementaryData struct {
					RelatedIDs struct {
						OrderID string `json:"order_id"`
					} `json:"related_ids"`
				} `json:"supplementary_data"`
			} `json:"resource"`
		}
		_ = json.Unmarshal(body, &env)
		orderID := env.Resource.SupplementaryData.RelatedIDs.OrderID
		if orderID == "" {
			orderID = env.Resource.ID
		}
		switch env.EventType {
		case "CHECKOUT.ORDER.APPROVED", "PAYMENT.CAPTURE.COMPLETED":
			_ = h.store.MarkPaid(r.Context(), "paypal", orderID, "")
		}
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
