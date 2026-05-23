package payments

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strconv"

	"github.com/babagemed/backend/internal/auth"
	"github.com/go-chi/chi/v5"
)

type Handler struct {
	pm    *Paymob
	pp    *PayPal
	store *Store // nil if DB not configured — webhooks still verify, just don't persist
}

func NewHandler() *Handler {
	return &Handler{pm: NewPaymob(), pp: NewPayPal()}
}

// WithStore wires DB-backed persistence into the handler.
func (h *Handler) WithStore(s *Store) *Handler {
	h.store = s
	return h
}

func (h *Handler) Register(r chi.Router) {
	r.Get("/api/payments/plans", h.ListPlans)
	r.Get("/api/payments/providers", h.Providers)

	r.Post("/api/payments/paymob/checkout", h.PaymobCheckout)
	r.Post("/api/payments/paymob/webhook", h.PaymobWebhook)

	r.Post("/api/payments/paypal/checkout", h.PayPalCheckout)
	r.Post("/api/payments/paypal/capture", h.PayPalCapture)
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
	out, err := h.pm.Checkout(b.PlanID, b.Billing)
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
	body, _ := io.ReadAll(r.Body)
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
	out, err := h.pp.Checkout(b.PlanID, b.ReturnURL, b.CancelURL)
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
	out, err := h.pp.Capture(b.OrderID)
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
	body, _ := io.ReadAll(r.Body)
	ok, err := h.pp.VerifyWebhook(r.Header, body)
	if err != nil {
		writeJSON(w, 401, map[string]string{"error": err.Error()})
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
