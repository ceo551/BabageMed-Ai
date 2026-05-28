package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/babagemed/backend/internal/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"
)

const (
	CookieName    = "babagemed_session"
	SessionTTL    = 30 * 24 * time.Hour
	BcryptCost    = 12
	tokenByteSize = 32
)

// dummyBcryptHash is a constant bcrypt hash we run the user's submitted
// password against when the email lookup misses. Without it, "user not
// found" returns instantly while "wrong password" burns ~100ms in
// bcrypt — a measurable timing oracle for email enumeration. Hash is
// of an opaque string the attacker can't precompute against.
//
// Re-generated at process startup so a hash leak via core dump doesn't
// let an attacker pre-image a useful password.
var dummyBcryptHash = func() string {
	// 32-byte random secret → bcrypt at the same cost as live hashes.
	var buf [32]byte
	_, _ = rand.Read(buf[:])
	h, _ := bcrypt.GenerateFromPassword(buf[:], BcryptCost)
	return string(h)
}()

type User struct {
	ID            string    `json:"id"`
	Email          string     `json:"email"`
	DisplayName    string     `json:"displayName"`
	PreferredName  string     `json:"preferredName"`
	Profession     string     `json:"profession"`
	Instructions   string     `json:"instructions"`
	Plan           string     `json:"plan"`
	IsAdmin        bool       `json:"isAdmin"`
	// EmailVerifiedAt is the timestamp at which the user proved control
	// of their email address. NULL pre-verification so the frontend can
	// render a "verify your email" banner.
	EmailVerifiedAt *time.Time `json:"emailVerifiedAt,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
}

type ctxKey struct{ name string }

var userCtxKey = ctxKey{"user"}

var (
	ErrAlreadyExists  = errors.New("email already registered")
	ErrInvalidCreds   = errors.New("invalid email or password")
	ErrWeakPassword   = errors.New("password must be at least 8 characters")
	ErrInvalidEmail   = errors.New("invalid email")
	ErrUnauthorised   = errors.New("not authenticated")
	ErrSessionExpired = errors.New("session expired")
)

type Service struct {
	db *db.DB
}

func New(d *db.DB) *Service { return &Service{db: d} }

// ─── Public API ────────────────────────────────────────────────────────────

func (s *Service) Signup(ctx context.Context, email, password, displayName string) (*User, string, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if !looksLikeEmail(email) {
		return nil, "", ErrInvalidEmail
	}
	if len(password) < 8 {
		return nil, "", ErrWeakPassword
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), BcryptCost)
	if err != nil {
		return nil, "", err
	}
	var u User
	err = s.db.Pool.QueryRow(ctx, `
        INSERT INTO users (email, password_hash, display_name)
        VALUES ($1, $2, NULLIF($3, ''))
        RETURNING id, email, COALESCE(display_name, ''), preferred_name, profession, instructions, plan, is_admin, email_verified_at, created_at
    `, email, string(hash), displayName).Scan(&u.ID, &u.Email, &u.DisplayName, &u.PreferredName, &u.Profession, &u.Instructions, &u.Plan, &u.IsAdmin, &u.EmailVerifiedAt, &u.CreatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, "", ErrAlreadyExists
		}
		return nil, "", err
	}
	token, err := s.createSession(ctx, u.ID, "", "")
	if err != nil {
		return nil, "", err
	}
	return &u, token, nil
}

// CheckPassword runs only the password-verification step of Login. It
// performs the email-enumeration timing defence (bcrypt against a dummy
// hash on lookup miss) but does NOT mint a session. Callers use this
// when an additional gate (MFA) sits between password and session.
func (s *Service) CheckPassword(ctx context.Context, email, password string) (*User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	var u User
	var hash string
	err := s.db.Pool.QueryRow(ctx, `
        SELECT id, email, COALESCE(display_name, ''), preferred_name, profession, instructions, plan, is_admin, email_verified_at, created_at, password_hash
        FROM users WHERE email = $1
    `, email).Scan(&u.ID, &u.Email, &u.DisplayName, &u.PreferredName, &u.Profession, &u.Instructions, &u.Plan, &u.IsAdmin, &u.EmailVerifiedAt, &u.CreatedAt, &hash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			_ = bcrypt.CompareHashAndPassword([]byte(dummyBcryptHash), []byte(password))
			return nil, ErrInvalidCreds
		}
		return nil, err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		return nil, ErrInvalidCreds
	}
	return &u, nil
}

// MintSession is the second half of Login — kept exported so the
// handler can mint the session AFTER the MFA gate has been cleared.
// Rotates any prior session cookie the request arrived with.
func (s *Service) MintSession(ctx context.Context, userID, priorToken, ua, ip string) (string, error) {
	if priorToken != "" {
		_ = s.Logout(ctx, priorToken)
	}
	return s.createSession(ctx, userID, ua, ip)
}

// Login authenticates a user (password only). Kept for callers that
// don't need the MFA gate; the HTTP handler uses CheckPassword +
// MintSession instead so it can interleave the second-factor check.
// priorToken, when non-empty, is the session cookie value the caller
// arrived with — Login invalidates it on success (session fixation
// defence).
func (s *Service) Login(ctx context.Context, email, password, priorToken, ua, ip string) (*User, string, error) {
	u, err := s.CheckPassword(ctx, email, password)
	if err != nil {
		return nil, "", err
	}
	token, err := s.MintSession(ctx, u.ID, priorToken, ua, ip)
	if err != nil {
		return nil, "", err
	}
	return u, token, nil
}

func (s *Service) Logout(ctx context.Context, token string) error {
	if token == "" {
		return nil
	}
	h := hashToken(token)
	_, err := s.db.Pool.Exec(ctx, `DELETE FROM sessions WHERE token_hash = $1`, h)
	return err
}

// LogoutAll revokes every session for the given user — the "sign out
// from all devices" affordance Settings exposes. Used when a user
// suspects credential compromise; the next request from any other
// device will hit the session-not-found path and force a re-login.
func (s *Service) LogoutAll(ctx context.Context, userID string) error {
	if userID == "" {
		return nil
	}
	_, err := s.db.Pool.Exec(ctx, `DELETE FROM sessions WHERE user_id = $1`, userID)
	return err
}

func (s *Service) Me(ctx context.Context, token string) (*User, error) {
	if token == "" {
		return nil, ErrUnauthorised
	}
	h := hashToken(token)
	var u User
	var exp time.Time
	err := s.db.Pool.QueryRow(ctx, `
        SELECT u.id, u.email, COALESCE(u.display_name, ''), u.preferred_name, u.profession, u.instructions, u.plan, u.is_admin, u.email_verified_at, u.created_at, s.expires_at
        FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1
    `, h).Scan(&u.ID, &u.Email, &u.DisplayName, &u.PreferredName, &u.Profession, &u.Instructions, &u.Plan, &u.IsAdmin, &u.EmailVerifiedAt, &u.CreatedAt, &exp)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUnauthorised
		}
		return nil, err
	}
	if time.Now().After(exp) {
		_, _ = s.db.Pool.Exec(ctx, `DELETE FROM sessions WHERE token_hash = $1`, h)
		return nil, ErrSessionExpired
	}
	return &u, nil
}

// GetUser fetches a user by ID — used after PATCH /api/auth/me so the
// response carries the freshly-persisted row.
func (s *Service) GetUser(ctx context.Context, id string) (*User, error) {
	var u User
	err := s.db.Pool.QueryRow(ctx, `
        SELECT id, email, COALESCE(display_name, ''), preferred_name, profession, instructions, plan, is_admin, email_verified_at, created_at
        FROM users WHERE id = $1
    `, id).Scan(&u.ID, &u.Email, &u.DisplayName, &u.PreferredName, &u.Profession, &u.Instructions, &u.Plan, &u.IsAdmin, &u.EmailVerifiedAt, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// ProfilePatch carries the body of PATCH /api/auth/me. Every field is a
// pointer so omission means "leave unchanged" — distinct from sending the
// empty string which clears the field.
type ProfilePatch struct {
	DisplayName   *string `json:"displayName,omitempty"`
	PreferredName *string `json:"preferredName,omitempty"`
	Profession    *string `json:"profession,omitempty"`
	Instructions  *string `json:"instructions,omitempty"`
}

// UpdateProfile applies any non-nil fields from the request to the user row.
// Each field is independently patchable so the UI can ship Save calls for
// just the changed sub-section. We don't expose plan / isAdmin / email here.
func (s *Service) UpdateProfile(ctx context.Context, id string, p ProfilePatch) error {
	set := []string{}
	args := []any{}
	if p.DisplayName != nil {
		args = append(args, *p.DisplayName)
		set = append(set, "display_name = NULLIF($"+strconv.Itoa(len(args))+", '')")
	}
	if p.PreferredName != nil {
		args = append(args, *p.PreferredName)
		set = append(set, "preferred_name = $"+strconv.Itoa(len(args)))
	}
	if p.Profession != nil {
		args = append(args, *p.Profession)
		set = append(set, "profession = $"+strconv.Itoa(len(args)))
	}
	if p.Instructions != nil {
		args = append(args, *p.Instructions)
		set = append(set, "instructions = $"+strconv.Itoa(len(args)))
	}
	if len(set) == 0 {
		return nil
	}
	args = append(args, id)
	q := "UPDATE users SET " + strings.Join(set, ", ") + " WHERE id = $" + strconv.Itoa(len(args))
	_, err := s.db.Pool.Exec(ctx, q, args...)
	return err
}

// UsageItem is one row of the Usage tab. Limit is a soft display number
// (informational only — no enforcement layer yet) sourced from the user's
// plan tier; 0 means "unlimited / not tracked".
type UsageItem struct {
	Model string `json:"model"`
	Count int64  `json:"count"`
	Limit int64  `json:"limit"`
}

// UsageByModel groups assistant-side messages by chat model for the last
// 30 days. Joins chats on chat_messages so we count actual answers, not
// just chat opens — and uses chats.model so streamed-but-aborted requests
// (which never persist an assistant row) don't pad the count.
func (s *Service) UsageByModel(ctx context.Context, userID string) ([]UsageItem, error) {
	rows, err := s.db.Pool.Query(ctx, `
        SELECT COALESCE(c.model, 'unknown') AS model, COUNT(*) AS n
        FROM chat_messages m
        JOIN chats c ON c.id = m.chat_id
        WHERE c.user_id = $1
          AND m.role = 'assistant'
          AND m.created_at > now() - interval '30 days'
        GROUP BY 1
        ORDER BY n DESC
    `, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []UsageItem{}
	for rows.Next() {
		var it UsageItem
		if err := rows.Scan(&it.Model, &it.Count); err != nil {
			return nil, err
		}
		out = append(out, it)
	}
	return out, nil
}

// ─── HTTP middleware ───────────────────────────────────────────────────────

// Required forces a valid session; 401s otherwise. The user is placed in ctx.
func (s *Service) Required(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, err := s.userFromRequest(r)
		if err != nil {
			http.Error(w, "unauthorised", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), userCtxKey, u)))
	})
}

// Optional reads the session if present but doesn't reject anonymous requests.
func (s *Service) Optional(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, err := s.userFromRequest(r)
		if err == nil && u != nil {
			r = r.WithContext(context.WithValue(r.Context(), userCtxKey, u))
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Service) userFromRequest(r *http.Request) (*User, error) {
	c, err := r.Cookie(CookieName)
	if err != nil {
		// fallback to Authorization: Bearer <token>
		auth := r.Header.Get("Authorization")
		if strings.HasPrefix(auth, "Bearer ") {
			return s.Me(r.Context(), strings.TrimPrefix(auth, "Bearer "))
		}
		return nil, ErrUnauthorised
	}
	return s.Me(r.Context(), c.Value)
}

func FromContext(ctx context.Context) *User {
	u, _ := ctx.Value(userCtxKey).(*User)
	return u
}

// SetCookie writes the session cookie to the response. Secure flag is enabled
// whenever the originating request looks like it came over HTTPS (or the
// X-Forwarded-Proto header says https — works behind a reverse proxy).
func SetCookie(w http.ResponseWriter, r *http.Request, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   isSecure(r),
		// SameSite=Strict — combined with the Origin/Referer check
		// middleware in main.go, this blocks the multipart-upload CSRF
		// path. If a future feature needs top-level cross-site GETs
		// (OAuth redirect, magic-link landing) to carry the cookie,
		// flip *that* response cookie to Lax explicitly rather than
		// loosening the default.
		SameSite: http.SameSiteStrictMode,
		Expires:  time.Now().Add(SessionTTL),
		MaxAge:   int(SessionTTL.Seconds()),
	})
}

func ClearCookie(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   isSecure(r),
		// SameSite=Strict — combined with the Origin/Referer check
		// middleware in main.go, this blocks the multipart-upload CSRF
		// path. If a future feature needs top-level cross-site GETs
		// (OAuth redirect, magic-link landing) to carry the cookie,
		// flip *that* response cookie to Lax explicitly rather than
		// loosening the default.
		SameSite: http.SameSiteStrictMode,
		MaxAge:   -1,
	})
}

// ─── helpers ────────────────────────────────────────────────────────────────

func (s *Service) createSession(ctx context.Context, userID, ua, ip string) (string, error) {
	raw := make([]byte, tokenByteSize)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	token := base64.RawURLEncoding.EncodeToString(raw)
	h := hashToken(token)
	exp := time.Now().Add(SessionTTL)
	_, err := s.db.Pool.Exec(ctx, `
        INSERT INTO sessions (user_id, token_hash, user_agent, ip, expires_at)
        VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), $5)
    `, userID, h, ua, ip, exp)
	if err != nil {
		return "", err
	}
	return token, nil
}

func hashToken(t string) string {
	sum := sha256.Sum256([]byte(t))
	return hex.EncodeToString(sum[:])
}

func looksLikeEmail(s string) bool {
	at := strings.Index(s, "@")
	dot := strings.LastIndex(s, ".")
	return at > 0 && dot > at+1 && dot < len(s)-1
}

// isUniqueViolation matches Postgres's unique_violation SQLSTATE rather
// than a substring of the localised error message — the latter breaks
// silently when the DB locale changes or pgx wraps the error.
func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	// Belt-and-braces fallback for already-wrapped errors that escape
	// `errors.As` (custom wrappers in callers).
	s := err.Error()
	return strings.Contains(s, "duplicate key") || strings.Contains(s, "unique constraint") || strings.Contains(s, "SQLSTATE 23505")
}

func isSecure(r *http.Request) bool {
	if r.TLS != nil {
		return true
	}
	return strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
}
