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
	"golang.org/x/crypto/bcrypt"
)

const (
	CookieName    = "babagemed_session"
	SessionTTL    = 30 * 24 * time.Hour
	BcryptCost    = 12
	tokenByteSize = 32
)

type User struct {
	ID            string    `json:"id"`
	Email         string    `json:"email"`
	DisplayName   string    `json:"displayName"`
	PreferredName string    `json:"preferredName"`
	Profession    string    `json:"profession"`
	Instructions  string    `json:"instructions"`
	Plan          string    `json:"plan"`
	IsAdmin       bool      `json:"isAdmin"`
	CreatedAt     time.Time `json:"createdAt"`
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
        RETURNING id, email, COALESCE(display_name, ''), preferred_name, profession, instructions, plan, is_admin, created_at
    `, email, string(hash), displayName).Scan(&u.ID, &u.Email, &u.DisplayName, &u.PreferredName, &u.Profession, &u.Instructions, &u.Plan, &u.IsAdmin, &u.CreatedAt)
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

func (s *Service) Login(ctx context.Context, email, password, ua, ip string) (*User, string, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	var u User
	var hash string
	err := s.db.Pool.QueryRow(ctx, `
        SELECT id, email, COALESCE(display_name, ''), preferred_name, profession, instructions, plan, is_admin, created_at, password_hash
        FROM users WHERE email = $1
    `, email).Scan(&u.ID, &u.Email, &u.DisplayName, &u.PreferredName, &u.Profession, &u.Instructions, &u.Plan, &u.IsAdmin, &u.CreatedAt, &hash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, "", ErrInvalidCreds
		}
		return nil, "", err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		return nil, "", ErrInvalidCreds
	}
	token, err := s.createSession(ctx, u.ID, ua, ip)
	if err != nil {
		return nil, "", err
	}
	return &u, token, nil
}

func (s *Service) Logout(ctx context.Context, token string) error {
	if token == "" {
		return nil
	}
	h := hashToken(token)
	_, err := s.db.Pool.Exec(ctx, `DELETE FROM sessions WHERE token_hash = $1`, h)
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
        SELECT u.id, u.email, COALESCE(u.display_name, ''), u.preferred_name, u.profession, u.instructions, u.plan, u.is_admin, u.created_at, s.expires_at
        FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1
    `, h).Scan(&u.ID, &u.Email, &u.DisplayName, &u.PreferredName, &u.Profession, &u.Instructions, &u.Plan, &u.IsAdmin, &u.CreatedAt, &exp)
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
        SELECT id, email, COALESCE(display_name, ''), preferred_name, profession, instructions, plan, is_admin, created_at
        FROM users WHERE id = $1
    `, id).Scan(&u.ID, &u.Email, &u.DisplayName, &u.PreferredName, &u.Profession, &u.Instructions, &u.Plan, &u.IsAdmin, &u.CreatedAt)
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
		SameSite: http.SameSiteLaxMode,
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
		SameSite: http.SameSiteLaxMode,
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

func isUniqueViolation(err error) bool {
	return strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "unique constraint")
}

func isSecure(r *http.Request) bool {
	if r.TLS != nil {
		return true
	}
	return strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
}
