package mfa

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/babagemed/backend/internal/audit"
	"github.com/babagemed/backend/internal/auth"
	"github.com/go-chi/chi/v5"
)

// Handler exposes the per-user MFA endpoints. All routes require an
// authenticated session — Login's two-step branch handles the case
// where MFA is enabled but the user hasn't authenticated yet (the
// session cookie is set only after the second factor succeeds).
type Handler struct {
	svc   *Service
	auth  *auth.Service
	audit *audit.Service
}

func NewHandler(s *Service, a *auth.Service, au *audit.Service) *Handler {
	return &Handler{svc: s, auth: a, audit: au}
}

func (h *Handler) Register(r chi.Router) {
	r.Group(func(pr chi.Router) {
		pr.Use(h.auth.Required)
		pr.Post("/api/auth/mfa/enroll/start", h.start)
		pr.Post("/api/auth/mfa/enroll/confirm", h.confirm)
		pr.Get("/api/auth/mfa/status", h.status)
		pr.Post("/api/auth/mfa/disable", h.disable)
	})
}

// statusResp mirrors what the frontend's Settings page wants to render:
// is MFA enabled, when was it enabled, how many backup codes remain.
type statusResp struct {
	Enabled         bool   `json:"enabled"`
	EnabledAt       string `json:"enabledAt,omitempty"`
	BackupCodesLeft int    `json:"backupCodesLeft"`
}

func (h *Handler) status(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	if u == nil {
		writeErr(w, 401, "not authenticated")
		return
	}
	enabled, err := h.svc.IsEnabled(r.Context(), u.ID)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	out := statusResp{Enabled: enabled}
	if enabled {
		_ = h.svc.db.Pool.QueryRow(r.Context(),
			`SELECT count(*) FROM user_mfa_backup_codes WHERE user_id = $1 AND used_at IS NULL`,
			u.ID).Scan(&out.BackupCodesLeft)
	}
	writeJSON(w, 200, out)
}

type startResp struct {
	URI    string `json:"uri"`
	Secret string `json:"secret"`
}

func (h *Handler) start(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	if u == nil {
		writeErr(w, 401, "not authenticated")
		return
	}
	uri, secret, err := h.svc.EnrollStart(r.Context(), u.ID, u.Email)
	if err != nil {
		if errors.Is(err, ErrMFAEncKeyMissing) {
			writeErr(w, 503, "mfa not configured on this server")
			return
		}
		if errors.Is(err, ErrMFAAlreadyEnabled) {
			writeErr(w, 409, "mfa already enabled — disable first to re-enroll")
			return
		}
		writeErr(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, startResp{URI: uri, Secret: secret})
}

type confirmReq struct {
	Code string `json:"code"`
}
type confirmResp struct {
	BackupCodes []string `json:"backupCodes"`
}

func (h *Handler) confirm(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	if u == nil {
		writeErr(w, 401, "not authenticated")
		return
	}
	var b confirmReq
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<14)).Decode(&b); err != nil {
		writeErr(w, 400, "invalid json")
		return
	}
	codes, err := h.svc.EnrollConfirm(r.Context(), u.ID, b.Code)
	if err != nil {
		switch {
		case errors.Is(err, ErrMFAEnrollNotPending):
			writeErr(w, 409, "no pending enrollment — start over")
		case errors.Is(err, ErrMFACodeInvalid):
			writeErr(w, 400, "invalid code — make sure your authenticator's clock is synced")
		case errors.Is(err, ErrMFAEncKeyMissing):
			writeErr(w, 503, "mfa not configured on this server")
		default:
			writeErr(w, 500, err.Error())
		}
		return
	}
	if h.audit != nil {
		h.audit.Record(r.Context(), r, u.ID, u.ID, "auth.mfa.enable", nil)
	}
	writeJSON(w, 200, confirmResp{BackupCodes: codes})
}

type disableReq struct {
	Code string `json:"code"` // current TOTP / backup code, required as proof
}

func (h *Handler) disable(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	if u == nil {
		writeErr(w, 401, "not authenticated")
		return
	}
	var b disableReq
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<14)).Decode(&b); err != nil {
		writeErr(w, 400, "invalid json")
		return
	}
	// Require a fresh proof of the second factor — a stolen session
	// cookie alone should NOT be able to remove MFA from the account.
	if err := h.svc.Validate(r.Context(), u.ID, b.Code); err != nil {
		if errors.Is(err, ErrMFANotEnabled) {
			writeErr(w, 400, "mfa is not enabled")
			return
		}
		writeErr(w, 400, "invalid code")
		return
	}
	if err := h.svc.Disable(r.Context(), u.ID); err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	if h.audit != nil {
		h.audit.Record(r.Context(), r, u.ID, u.ID, "auth.mfa.disable", nil)
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
func writeErr(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
