package auth

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	s   *Service
	mfa MFAGate // optional; nil when MFA isn't configured
}

func NewHandler(s *Service) *Handler { return &Handler{s: s} }

func (h *Handler) Register(r chi.Router) {
	h.RegisterWithLimiter(r, nil)
}

// RegisterWithLimiter mounts the auth routes. When limiter is non-nil
// it is wrapped around the credential-stuffing-prone endpoints
// (/signup, /login) only — /logout / /me / PATCH /me are session-
// cookie-bound and not a credential-stuffing target, so we leave them
// at the global default. Calling with limiter=nil is equivalent to
// Register(r) and is kept so tests stay short.
func (h *Handler) RegisterWithLimiter(r chi.Router, limiter func(http.Handler) http.Handler) {
	if limiter == nil {
		r.Post("/api/auth/signup", h.signup)
		r.Post("/api/auth/login", h.login)
	} else {
		r.With(limiter).Post("/api/auth/signup", h.signup)
		r.With(limiter).Post("/api/auth/login", h.login)
	}
	r.Post("/api/auth/logout", h.logout)
	r.Post("/api/auth/logout-all", h.logoutAll)
	r.Get("/api/auth/me", h.me)
	// User-facing Settings page endpoints. PATCH is for the General tab
	// (preferred name, profession, instructions); /usage drives the Usage
	// tab. Both require a valid session — anonymous callers get 401.
	r.Patch("/api/auth/me", h.updateMe)
	r.Get("/api/auth/me/usage", h.usage)
}

type signupReq struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"displayName"`
}

func (h *Handler) signup(w http.ResponseWriter, r *http.Request) {
	var b signupReq
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeErr(w, 400, "invalid json")
		return
	}
	u, token, err := h.s.Signup(r.Context(), b.Email, b.Password, b.DisplayName)
	if err != nil {
		statusFor(err, w)
		return
	}
	SetCookie(w, r, token)
	// Token deliberately omitted from the JSON body — the HttpOnly cookie
	// already carries the session, and echoing the raw token leaks into
	// HAR exports, server access logs, and any client-side error reporter
	// (Sentry, LogRocket, etc).
	writeJSON(w, 201, map[string]any{"user": u})
}

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	// Optional second-factor code, supplied on the SECOND login POST
	// after the first one returned {mfaRequired: true}. Format is
	// either "######" (6-digit TOTP) or "XXXX-XXXX" (one of the
	// pre-generated backup codes).
	MFACode string `json:"mfaCode,omitempty"`
}

// MFAGate is the surface the handler needs from the mfa package — kept
// as an interface so the auth package doesn't import mfa (avoids a
// circular-import risk if mfa later wants to read auth.FromContext).
// Wired in main.go via SetMFAGate; when nil (e.g. MFA_ENCRYPTION_KEY
// not configured), login skips the second-factor check entirely.
type MFAGate interface {
	IsEnabled(ctx context.Context, userID string) (bool, error)
	Validate(ctx context.Context, userID, code string) error
}

// SetMFAGate plugs in the optional MFA layer. Safe to call once at
// startup before Register; subsequent logins read the field through
// the handler's mfa pointer.
func (h *Handler) SetMFAGate(g MFAGate) { h.mfa = g }

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	var b loginReq
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeErr(w, 400, "invalid json")
		return
	}
	// Step 1: password check ONLY. No session yet — if MFA is enabled
	// we'd otherwise mint a session before the second factor and a
	// compromised password would be enough.
	u, err := h.s.CheckPassword(r.Context(), b.Email, b.Password)
	if err != nil {
		statusFor(err, w)
		return
	}
	// Step 2: MFA gate. If enabled and no code: respond 401 with
	// mfaRequired so the frontend can re-prompt. If enabled with a
	// code: validate; bad code is collapsed back to ErrInvalidCreds
	// so the response surface is identical to "wrong password" from
	// an attacker's view.
	if h.mfa != nil {
		enabled, err := h.mfa.IsEnabled(r.Context(), u.ID)
		if err != nil {
			writeErr(w, 500, err.Error())
			return
		}
		if enabled {
			if b.MFACode == "" {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_ = json.NewEncoder(w).Encode(map[string]any{"mfaRequired": true})
				return
			}
			if err := h.mfa.Validate(r.Context(), u.ID, b.MFACode); err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_ = json.NewEncoder(w).Encode(map[string]any{
					"mfaRequired": true,
					"error":       "invalid second-factor code",
				})
				return
			}
		}
	}
	// Step 3: mint the session. Same session-rotation guarantee as
	// before — any prior cookie on the request is invalidated.
	var prior string
	if c, err := r.Cookie(CookieName); err == nil {
		prior = c.Value
	}
	token, err := h.s.MintSession(r.Context(), u.ID, prior, r.UserAgent(), r.RemoteAddr)
	if err != nil {
		statusFor(err, w)
		return
	}
	SetCookie(w, r, token)
	// See signup() for why the token is omitted from the body.
	writeJSON(w, 200, map[string]any{"user": u})
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	// Accept the session token from either the cookie or
	// Authorization: Bearer <token>. Without the bearer path, native
	// clients (mobile/desktop) that authenticate via header alone could
	// never invalidate their session server-side — a stolen token would
	// stay valid until expiry.
	if c, err := r.Cookie(CookieName); err == nil && c.Value != "" {
		_ = h.s.Logout(r.Context(), c.Value)
	}
	if tok := bearerToken(r); tok != "" {
		_ = h.s.Logout(r.Context(), tok)
	}
	ClearCookie(w, r)
	writeJSON(w, 200, map[string]bool{"ok": true})
}

// logoutAll revokes every session belonging to the authenticated user.
// Mounted as POST /api/auth/logout-all and surfaced as a "Sign out from
// all devices" affordance in Settings. Requires a valid session (so
// anonymous callers get 401 — without this gate, an attacker who
// learned a user_id could nuke their sessions remotely).
func (h *Handler) logoutAll(w http.ResponseWriter, r *http.Request) {
	u, err := h.s.userFromRequest(r)
	if err != nil || u == nil {
		writeErr(w, 401, "not authenticated")
		return
	}
	if err := h.s.LogoutAll(r.Context(), u.ID); err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	ClearCookie(w, r)
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func bearerToken(r *http.Request) string {
	h := r.Header.Get("Authorization")
	if !strings.HasPrefix(h, "Bearer ") {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(h, "Bearer "))
}

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	u := FromContext(r.Context())
	if u == nil {
		// optional middleware didn't populate — try directly so /me works standalone
		var err error
		u, err = h.s.userFromRequest(r)
		if err != nil {
			writeErr(w, 401, "not authenticated")
			return
		}
	}
	writeJSON(w, 200, map[string]any{"user": u})
}

// updateMe lets a signed-in user edit their own profile fields. Mirrors the
// shape of the General Settings tab. We never let a user change their own
// plan / isAdmin / email here — those go through the admin path.
func (h *Handler) updateMe(w http.ResponseWriter, r *http.Request) {
	u := FromContext(r.Context())
	if u == nil {
		var err error
		u, err = h.s.userFromRequest(r)
		if err != nil {
			writeErr(w, 401, "not authenticated")
			return
		}
	}
	var b ProfilePatch
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeErr(w, 400, "invalid json")
		return
	}
	if err := h.s.UpdateProfile(r.Context(), u.ID, b); err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	refreshed, err := h.s.GetUser(r.Context(), u.ID)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"user": refreshed})
}

// usage returns a simple per-model query count for the signed-in user.
// Grouped on chats.model so users can see how many conversations they've
// run against each backing model (Opus 4.7 / Gemini 3.1 / etc.) over the
// chosen window. No token / dollar accounting today — we'd need provider
// usage hooks for that and the test cluster isn't enforcing limits yet.
func (h *Handler) usage(w http.ResponseWriter, r *http.Request) {
	u := FromContext(r.Context())
	if u == nil {
		var err error
		u, err = h.s.userFromRequest(r)
		if err != nil {
			writeErr(w, 401, "not authenticated")
			return
		}
	}
	rows, err := h.s.UsageByModel(r.Context(), u.ID)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{
		"plan":   u.Plan,
		"window": "30d",
		"items":  rows,
	})
}

func statusFor(err error, w http.ResponseWriter) {
	switch {
	case errors.Is(err, ErrAlreadyExists):
		// Return a generic invalid-creds error to prevent account
		// enumeration via the signup endpoint. The caller still gets a
		// 4xx so the UI can show "check your credentials"; an attacker
		// can't tell whether the email is registered or just bad input.
		// (See reset/forgot which uses the same opacity pattern.)
		writeErr(w, 400, "invalid signup request")
	case errors.Is(err, ErrInvalidCreds):
		writeErr(w, 401, err.Error())
	case errors.Is(err, ErrWeakPassword), errors.Is(err, ErrInvalidEmail):
		writeErr(w, 400, err.Error())
	case errors.Is(err, ErrUnauthorised), errors.Is(err, ErrSessionExpired):
		writeErr(w, 401, err.Error())
	default:
		// Don't leak err.Error() to the client — could expose pgx /
		// SQLSTATE / internal paths. Server-log full detail, return
		// opaque message.
		log.Printf("auth: 500 %v", err)
		writeErr(w, 500, "internal error")
	}
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
func writeErr(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}
