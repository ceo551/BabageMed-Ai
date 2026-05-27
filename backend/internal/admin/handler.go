package admin

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/babagemed/backend/internal/auth"
	"github.com/babagemed/backend/internal/db"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

type Handler struct {
	db   *db.DB
	auth *auth.Service
}

func NewHandler(d *db.DB, a *auth.Service) *Handler {
	return &Handler{db: d, auth: a}
}

func (h *Handler) Register(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(h.auth.Required)
		r.Use(h.requireAdmin)
		r.Get("/api/admin/stats", h.Stats)
		r.Get("/api/admin/users", h.ListUsers)
		r.Get("/api/admin/users/{id}", h.GetUser)
		r.Patch("/api/admin/users/{id}", h.UpdateUser)
		// is_admin is intentionally NOT settable via the generic PATCH
		// route. Privilege promotion / demotion goes through a separate
		// endpoint that also blocks self-demotion so a compromised admin
		// account can't lock the org out of admin access.
		r.Post("/api/admin/users/{id}/promote", h.PromoteUser)
		r.Post("/api/admin/users/{id}/demote", h.DemoteUser)
		r.Delete("/api/admin/users/{id}", h.DeleteUser)
		r.Get("/api/admin/payments", h.ListPayments)
		r.Patch("/api/admin/payments/{id}", h.UpdatePayment)
		r.Get("/api/admin/sessions", h.ListSessions)
		r.Delete("/api/admin/sessions/{id}", h.RevokeSession)
	})
}

// requireAdmin runs *after* auth.Required so a user is in context.
func (h *Handler) requireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u := auth.FromContext(r.Context())
		if u == nil || !u.IsAdmin {
			writeErr(w, http.StatusForbidden, "admin only")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ─── Endpoints ─────────────────────────────────────────────────────────────

func (h *Handler) Stats(w http.ResponseWriter, r *http.Request) {
	type stats struct {
		Users           int64 `json:"users"`
		Admins          int64 `json:"admins"`
		ActiveSessions  int64 `json:"activeSessions"`
		PaymentsPaid    int64 `json:"paymentsPaid"`
		PaymentsPending int64 `json:"paymentsPending"`
		PaymentsFailed  int64 `json:"paymentsFailed"`
	}
	var s stats
	q := h.db.Pool.QueryRow(r.Context(), `
        SELECT
            (SELECT COUNT(*) FROM users),
            (SELECT COUNT(*) FROM users WHERE is_admin),
            (SELECT COUNT(*) FROM sessions WHERE expires_at > now()),
            (SELECT COUNT(*) FROM payments WHERE status = 'paid'),
            (SELECT COUNT(*) FROM payments WHERE status = 'pending'),
            (SELECT COUNT(*) FROM payments WHERE status = 'failed')
    `)
	if err := q.Scan(&s.Users, &s.Admins, &s.ActiveSessions, &s.PaymentsPaid, &s.PaymentsPending, &s.PaymentsFailed); err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, s)
}

type userRow struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	DisplayName string `json:"displayName"`
	Plan        string `json:"plan"`
	IsAdmin     bool   `json:"isAdmin"`
	CreatedAt   string `json:"createdAt"`
}

func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	limit := parseLimit(r, 50, 500)
	offset := parseOffset(r)
	q := r.URL.Query().Get("q")
	args := []any{limit, offset}
	where := ""
	if q != "" {
		where = "WHERE email ILIKE $3 OR display_name ILIKE $3"
		args = append(args, "%"+q+"%")
	}
	rows, err := h.db.Pool.Query(r.Context(), `
        SELECT id::text, email, COALESCE(display_name, ''), plan, is_admin, created_at::text
        FROM users `+where+` ORDER BY created_at DESC LIMIT $1 OFFSET $2
    `, args...)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	defer rows.Close()
	out := []userRow{}
	for rows.Next() {
		var u userRow
		if err := rows.Scan(&u.ID, &u.Email, &u.DisplayName, &u.Plan, &u.IsAdmin, &u.CreatedAt); err != nil {
			writeErr(w, 500, err.Error())
			return
		}
		out = append(out, u)
	}
	writeJSON(w, 200, map[string]any{"users": out, "limit": limit, "offset": offset})
}

func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var u userRow
	err := h.db.Pool.QueryRow(r.Context(), `
        SELECT id::text, email, COALESCE(display_name, ''), plan, is_admin, created_at::text
        FROM users WHERE id = $1
    `, id).Scan(&u.ID, &u.Email, &u.DisplayName, &u.Plan, &u.IsAdmin, &u.CreatedAt)
	if err != nil {
		// Distinguish "row doesn't exist" from a real DB outage so
		// operators don't see "user not found" while Postgres is down.
		if errors.Is(err, pgx.ErrNoRows) {
			writeErr(w, 404, "user not found")
			return
		}
		writeErr(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, u)
}

// userPatch deliberately does NOT include IsAdmin. Privilege changes go
// through PromoteUser / DemoteUser so we get audit-able dedicated
// endpoints (rather than a generic PATCH that happens to flip the bit)
// and so we can refuse self-demotion at the handler level. A compromised
// admin session can no longer escalate other users by stuffing
// `{"isAdmin": true}` into a generic edit.
type userPatch struct {
	Plan        *string `json:"plan"`
	DisplayName *string `json:"displayName"`
}

func (h *Handler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var p userPatch
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		writeErr(w, 400, "invalid json")
		return
	}
	set := []string{}
	args := []any{}
	if p.Plan != nil {
		args = append(args, *p.Plan)
		set = append(set, "plan = $"+strconv.Itoa(len(args)))
	}
	if p.DisplayName != nil {
		args = append(args, *p.DisplayName)
		set = append(set, "display_name = NULLIF($"+strconv.Itoa(len(args))+", '')")
	}
	if len(set) == 0 {
		writeErr(w, 400, "no fields to update")
		return
	}
	args = append(args, id)
	q := "UPDATE users SET " + join(set, ", ") + " WHERE id = $" + strconv.Itoa(len(args))
	tag, err := h.db.Pool.Exec(r.Context(), q, args...)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	if tag.RowsAffected() == 0 {
		writeErr(w, 404, "user not found")
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}

// PromoteUser flips is_admin = true on the target user. Self-promotion
// is a no-op (the caller is already admin); the endpoint is kept for
// symmetry with DemoteUser.
func (h *Handler) PromoteUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tag, err := h.db.Pool.Exec(r.Context(), `UPDATE users SET is_admin = TRUE WHERE id = $1`, id)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	if tag.RowsAffected() == 0 {
		writeErr(w, 404, "user not found")
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}

// DemoteUser flips is_admin = false, refusing to demote the caller —
// otherwise an admin could accidentally lock the org out of admin
// access. To leave the admin role, an operator must have another
// admin demote them.
func (h *Handler) DemoteUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	me := auth.FromContext(r.Context())
	if me != nil && me.ID == id {
		writeErr(w, http.StatusBadRequest, "an admin cannot demote themselves — ask another admin")
		return
	}
	tag, err := h.db.Pool.Exec(r.Context(), `UPDATE users SET is_admin = FALSE WHERE id = $1`, id)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	if tag.RowsAffected() == 0 {
		writeErr(w, 404, "user not found")
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func (h *Handler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	me := auth.FromContext(r.Context())
	if me != nil && me.ID == id {
		writeErr(w, 400, "cannot delete your own account from admin panel")
		return
	}
	tag, err := h.db.Pool.Exec(r.Context(), `DELETE FROM users WHERE id = $1`, id)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	if tag.RowsAffected() == 0 {
		writeErr(w, 404, "user not found")
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}

type paymentRow struct {
	ID          string `json:"id"`
	UserID      string `json:"userId"`
	UserEmail   string `json:"userEmail"`
	Provider    string `json:"provider"`
	ExternalID  string `json:"externalId"`
	PlanID      string `json:"planId"`
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
	Status      string `json:"status"`
	CreatedAt   string `json:"createdAt"`
}

func (h *Handler) ListPayments(w http.ResponseWriter, r *http.Request) {
	limit := parseLimit(r, 50, 500)
	offset := parseOffset(r)
	args := []any{limit, offset}
	where := ""
	if s := r.URL.Query().Get("status"); s != "" {
		args = append(args, s)
		where = "WHERE p.status = $3"
	}
	rows, err := h.db.Pool.Query(r.Context(), `
        SELECT p.id::text, COALESCE(p.user_id::text, ''), COALESCE(u.email, ''),
               p.provider, p.external_id, p.plan_id, p.amount_minor, p.currency,
               p.status, p.created_at::text
        FROM payments p LEFT JOIN users u ON u.id = p.user_id
        `+where+` ORDER BY p.created_at DESC LIMIT $1 OFFSET $2
    `, args...)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	defer rows.Close()
	out := []paymentRow{}
	for rows.Next() {
		var p paymentRow
		if err := rows.Scan(&p.ID, &p.UserID, &p.UserEmail, &p.Provider, &p.ExternalID,
			&p.PlanID, &p.AmountMinor, &p.Currency, &p.Status, &p.CreatedAt); err != nil {
			writeErr(w, 500, err.Error())
			return
		}
		out = append(out, p)
	}
	writeJSON(w, 200, map[string]any{"payments": out, "limit": limit, "offset": offset})
}

type paymentPatch struct {
	Status *string `json:"status"`
}

func (h *Handler) UpdatePayment(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var p paymentPatch
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil || p.Status == nil {
		writeErr(w, 400, "status required")
		return
	}
	switch *p.Status {
	case "pending", "paid", "failed", "refunded":
	default:
		writeErr(w, 400, "invalid status")
		return
	}
	tag, err := h.db.Pool.Exec(r.Context(), `UPDATE payments SET status = $1 WHERE id = $2`, *p.Status, id)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	if tag.RowsAffected() == 0 {
		writeErr(w, 404, "payment not found")
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}

type sessionRow struct {
	ID        string `json:"id"`
	UserID    string `json:"userId"`
	UserEmail string `json:"userEmail"`
	UserAgent string `json:"userAgent"`
	IP        string `json:"ip"`
	ExpiresAt string `json:"expiresAt"`
	CreatedAt string `json:"createdAt"`
}

func (h *Handler) ListSessions(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Pool.Query(r.Context(), `
        SELECT s.id::text, s.user_id::text, u.email,
               COALESCE(s.user_agent, ''), COALESCE(s.ip, ''),
               s.expires_at::text, s.created_at::text
        FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.expires_at > now()
        ORDER BY s.created_at DESC LIMIT 200
    `)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	defer rows.Close()
	out := []sessionRow{}
	for rows.Next() {
		var s sessionRow
		if err := rows.Scan(&s.ID, &s.UserID, &s.UserEmail, &s.UserAgent, &s.IP, &s.ExpiresAt, &s.CreatedAt); err != nil {
			writeErr(w, 500, err.Error())
			return
		}
		out = append(out, s)
	}
	writeJSON(w, 200, map[string]any{"sessions": out})
}

func (h *Handler) RevokeSession(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tag, err := h.db.Pool.Exec(r.Context(), `DELETE FROM sessions WHERE id = $1`, id)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	if tag.RowsAffected() == 0 {
		writeErr(w, 404, "session not found")
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}

// ─── helpers ────────────────────────────────────────────────────────────────

func parseLimit(r *http.Request, def, max int) int {
	v, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if v <= 0 {
		v = def
	}
	if v > max {
		v = max
	}
	return v
}

func parseOffset(r *http.Request) int {
	v, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if v < 0 {
		v = 0
	}
	return v
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
func writeErr(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}

func join(parts []string, sep string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += sep
		}
		out += p
	}
	return out
}

// silence unused-context warning if helper grows
var _ = context.Background
