package payments

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"

	"github.com/pervagans/backend/internal/auth"
	"github.com/go-chi/chi/v5"
)

// Required is the subset of *auth.Service we depend on; declared as an
// interface so test handlers don't need a full Service.
type Required interface {
	Required(http.Handler) http.Handler
}

type Handler struct {
	pd      *Paddle
	store   *Store   // nil if DB not configured — webhooks still verify, just don't persist
	authSvc Required // nil → checkout endpoints stay anonymous
}

func NewHandler() *Handler {
	return &Handler{pd: NewPaddle()}
}

// WithStore wires DB-backed persistence into the handler.
func (h *Handler) WithStore(s *Store) *Handler {
	h.store = s
	return h
}

// WithAuth gates checkout behind a real user session. The webhook stays
// unauthenticated — it's verified by Paddle's signature instead, because the
// upstream call comes from Paddle's servers, not the user's browser.
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
	gated("/api/payments/paddle/checkout", h.PaddleCheckout)

	// Webhook is signature-verified, not session-verified.
	r.Post("/api/payments/paddle/webhook", h.PaddleWebhook)
}

// ─── Discovery ─────────────────────────────────────────────────────────────

func (h *Handler) ListPlans(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, map[string]any{"plans": ListPlans()})
}

func (h *Handler) Providers(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, map[string]any{
		"paddle": h.pd.Configured(),
	})
}

// isAllowedReturn checks that a return/success URL stays on our own origin so
// the checkout flow can't be turned into an open redirect. Empty publicBase
// means the env var isn't set — we treat every URL as disallowed to force the
// caller into the safe default branch.
func isAllowedReturn(raw, publicBase string) bool {
	if publicBase == "" || raw == "" {
		return false
	}
	// strings.HasPrefix is intentional: PUBLIC_BASE_URL is
	// "https://app.babagemed.com" (no trailing slash) and we require the URL
	// to start with that origin + "/" so "https://app.babagemed.com.evil.com/x"
	// can't match.
	return strings.HasPrefix(raw, publicBase+"/")
}

// ─── Paddle ────────────────────────────────────────────────────────────────

type paddleReq struct {
	PlanID string `json:"plan_id"`
}

func (h *Handler) PaddleCheckout(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 16<<10)
	var b paddleReq
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		http.Error(w, "invalid json", 400)
		return
	}
	uid := ""
	if u := auth.FromContext(r.Context()); u != nil {
		uid = u.ID
	}
	out, err := h.pd.Checkout(r.Context(), uid, b.PlanID)
	if err != nil {
		// Don't echo upstream provider errors verbatim — Paddle responses can
		// include internal ids. Log full text server-side; give the client a
		// generic message.
		log.Printf("payments: 502 upstream error: %v", err)
		writeJSON(w, 502, map[string]string{"error": "payment provider unavailable"})
		return
	}
	if h.store != nil {
		var uidPtr *string
		if uid != "" {
			uidPtr = &uid
		}
		plan, _ := GetPlan(b.PlanID)
		// Record a pending row keyed by the transaction id so the webhook can
		// flip it to paid and upgrade the user.
		_ = h.store.Record(r.Context(), uidPtr, "paddle", out.TransactionID, b.PlanID, plan.USD, "USD", "pending", nil)
	}
	writeJSON(w, 200, out)
}

func (h *Handler) PaddleWebhook(w http.ResponseWriter, r *http.Request) {
	// Cap body so a malicious request can't OOM the process. Paddle events are
	// typically a few KB; 1 MiB is generously above any real payload.
	body, _ := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if !h.pd.VerifyWebhook(r.Header.Get("Paddle-Signature"), body) {
		http.Error(w, "bad signature", 401)
		return
	}
	var env struct {
		EventType string `json:"event_type"`
		Data      struct {
			ID         string `json:"id"`
			CustomData struct {
				UserID string `json:"user_id"`
				PlanID string `json:"plan_id"`
			} `json:"custom_data"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &env); err != nil {
		// Malformed body is the caller's fault → 400 so Paddle's retry loop
		// doesn't hammer a message we'd never accept.
		writeJSON(w, 400, map[string]string{"error": "bad webhook body"})
		return
	}
	switch env.EventType {
	case "transaction.completed", "transaction.paid":
		if h.store != nil {
			// MarkPaid flips the pending row (recorded at checkout) to paid and
			// upgrades the linked user's plan; on a renewal txn id it has never
			// seen it self-heals by inserting a paid row from custom_data, so
			// recurring revenue after month one isn't lost (see persistence.go).
			_ = h.store.MarkPaid(r.Context(), "paddle", env.Data.ID, env.Data.CustomData.UserID, env.Data.CustomData.PlanID)
		}
	case "subscription.canceled", "subscription.paused", "subscription.past_due",
		"transaction.refunded", "transaction.canceled", "transaction.payment_failed":
		// Billing stopped / reversed → drop the user back to free so paid access
		// doesn't persist forever (the revenue leak). custom_data is propagated
		// by Paddle onto subscription + transaction events. A later
		// transaction.completed re-upgrades if they recover (e.g. past_due).
		if h.store != nil && env.Data.CustomData.UserID != "" {
			_ = h.store.SetPlanFree(r.Context(), env.Data.CustomData.UserID)
		}
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
