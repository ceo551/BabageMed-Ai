package auth

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
)

type Handler struct{ s *Service }

func NewHandler(s *Service) *Handler { return &Handler{s: s} }

func (h *Handler) Register(r chi.Router) {
	r.Post("/api/auth/signup", h.signup)
	r.Post("/api/auth/login", h.login)
	r.Post("/api/auth/logout", h.logout)
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
	writeJSON(w, 201, map[string]any{"user": u, "token": token})
}

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	var b loginReq
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeErr(w, 400, "invalid json")
		return
	}
	u, token, err := h.s.Login(r.Context(), b.Email, b.Password, r.UserAgent(), r.RemoteAddr)
	if err != nil {
		statusFor(err, w)
		return
	}
	SetCookie(w, r, token)
	writeJSON(w, 200, map[string]any{"user": u, "token": token})
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(CookieName); err == nil {
		_ = h.s.Logout(r.Context(), c.Value)
	}
	ClearCookie(w, r)
	writeJSON(w, 200, map[string]bool{"ok": true})
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
		writeErr(w, 409, err.Error())
	case errors.Is(err, ErrInvalidCreds):
		writeErr(w, 401, err.Error())
	case errors.Is(err, ErrWeakPassword), errors.Is(err, ErrInvalidEmail):
		writeErr(w, 400, err.Error())
	case errors.Is(err, ErrUnauthorised), errors.Is(err, ErrSessionExpired):
		writeErr(w, 401, err.Error())
	default:
		writeErr(w, 500, err.Error())
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
