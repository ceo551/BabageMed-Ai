package auth

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/babbage/backend/internal/audit"
	"github.com/babbage/backend/internal/email"
	"github.com/go-chi/chi/v5"
)

// ResetHandler exposes the password-reset + email-verify HTTP routes.
// Kept separate from the main auth Handler so the dependency on the
// email package (which most auth callers don't need) stays optional —
// main.go decides whether to register these routes based on whether
// SMTP is configured. Console driver is acceptable in dev, so the
// routes register unconditionally and the messages just hit the log.
type ResetHandler struct {
	s     *Service
	email email.Sender
	audit *audit.Service
}

func NewResetHandler(s *Service, e email.Sender, a *audit.Service) *ResetHandler {
	return &ResetHandler{s: s, email: e, audit: a}
}

func (h *ResetHandler) Register(r chi.Router) {
	r.Post("/api/auth/forgot-password", h.forgot)
	r.Post("/api/auth/reset-password", h.reset)
	r.Post("/api/auth/resend-verify", h.resendVerify)
	r.Post("/api/auth/verify-email", h.verify)
}

type forgotReq struct {
	Email string `json:"email"`
}

func (h *ResetHandler) forgot(w http.ResponseWriter, r *http.Request) {
	var b forgotReq
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<16)).Decode(&b); err != nil {
		writeErr(w, 400, "invalid json")
		return
	}
	// SendPasswordResetEmail is intentionally opaque — it never errors
	// on "no such email" so we can't accidentally leak which addresses
	// are registered via response code. Bubble only true transport
	// errors.
	if err := h.s.SendPasswordResetEmail(r.Context(), h.email, b.Email); err != nil {
		// Still return 200 — the user-visible flow is "if the email
		// matches an account we just sent a link". Audit captures the
		// failure so an operator notices an SMTP outage.
		if h.audit != nil {
			h.audit.Record(r.Context(), r, "", "", "auth.password.reset_request.error", map[string]any{"err": err.Error()})
		}
	} else if h.audit != nil {
		h.audit.Record(r.Context(), r, "", "", "auth.password.reset_request", map[string]any{"email": b.Email})
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}

type resetReq struct {
	Email       string `json:"email"`
	Token       string `json:"token"`
	NewPassword string `json:"newPassword"`
}

func (h *ResetHandler) reset(w http.ResponseWriter, r *http.Request) {
	var b resetReq
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<16)).Decode(&b); err != nil {
		writeErr(w, 400, "invalid json")
		return
	}
	err := h.s.CompletePasswordReset(r.Context(), b.Email, b.Token, b.NewPassword)
	if err != nil {
		// ErrWeakPassword is the one error we DO surface specifically
		// (otherwise the UI can't tell the user "use more characters"
		// vs "your link expired"). Everything else collapses to a
		// vague 400 so a token-fishing attacker can't distinguish
		// expired-but-real from never-existed.
		if errors.Is(err, ErrWeakPassword) {
			writeErr(w, 400, ErrWeakPassword.Error())
			return
		}
		if h.audit != nil {
			h.audit.Record(r.Context(), r, "", "", "auth.password.reset_complete.fail", map[string]any{"email": b.Email})
		}
		writeErr(w, 400, "invalid or expired reset token")
		return
	}
	if h.audit != nil {
		h.audit.Record(r.Context(), r, "", "", "auth.password.reset_complete", map[string]any{"email": b.Email})
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}

// resendVerify is authenticated — only the logged-in user can request a
// new link to their own email. Anonymous "resend to X" would let an
// attacker pummel the SMTP relay with bogus verifies aimed at any
// known address.
func (h *ResetHandler) resendVerify(w http.ResponseWriter, r *http.Request) {
	u, err := h.s.userFromRequest(r)
	if err != nil || u == nil {
		writeErr(w, 401, "not authenticated")
		return
	}
	if err := h.s.SendVerificationEmail(r.Context(), h.email, u.ID, u.Email); err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}

type verifyReq struct {
	UserID string `json:"uid"`
	Token  string `json:"token"`
}

func (h *ResetHandler) verify(w http.ResponseWriter, r *http.Request) {
	var b verifyReq
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<16)).Decode(&b); err != nil {
		writeErr(w, 400, "invalid json")
		return
	}
	if err := h.s.CompleteEmailVerification(r.Context(), b.UserID, b.Token); err != nil {
		writeErr(w, 400, "invalid or expired verification token")
		return
	}
	if h.audit != nil {
		h.audit.Record(r.Context(), r, "", b.UserID, "auth.email.verify_complete", nil)
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}
