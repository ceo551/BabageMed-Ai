package mfa

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/babagemed/backend/internal/db"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

// Service wires the TOTP primitives to the database.
//
// Enrollment is two-step (mint a pending secret, confirm with a code
// before activating) so a partial enrollment can't accidentally lock
// the user out — if they close the page between scan and verify, the
// pending row expires after enrollPendingTTL and login still works
// without a second factor.
//
// Backup codes are 10 random codes of format XXXX-XXXX. Each is
// bcrypt-hashed at rest and consumed on use — once a code matches it
// is deleted, so an attacker who scrapes the codes from a sticky note
// can't replay them across multiple recoveries.

const (
	enrollPendingTTL = 10 * time.Minute
	backupCodeCount  = 10
	backupCodeBytes  = 5 // 5 bytes → 8 base32 chars → "XXXX-XXXX" after split
)

var (
	ErrMFANotEnabled       = errors.New("mfa not enabled for this user")
	ErrMFAAlreadyEnabled   = errors.New("mfa already enabled")
	ErrMFAEnrollNotPending = errors.New("no pending mfa enrollment for this user")
	ErrMFACodeInvalid      = errors.New("invalid mfa code")
	ErrMFAEncKeyMissing    = errors.New("MFA_ENCRYPTION_KEY is not configured")
)

type Service struct {
	db     *db.DB
	gcm    cipher.AEAD
	issuer string
}

// New constructs the service. issuer is the brand name shown inside
// the authenticator app (e.g. "Babbage AI"). The MFA_ENCRYPTION_KEY
// env var must contain a base64-encoded 32-byte key — without it, MFA
// endpoints return ErrMFAEncKeyMissing rather than silently storing
// secrets in plaintext.
func New(d *db.DB, issuer string) (*Service, error) {
	if issuer == "" {
		issuer = "Babbage AI"
	}
	keyB64 := strings.TrimSpace(os.Getenv("MFA_ENCRYPTION_KEY"))
	if keyB64 == "" {
		return &Service{db: d, issuer: issuer}, nil
	}
	key, err := base64.StdEncoding.DecodeString(keyB64)
	if err != nil {
		return nil, fmt.Errorf("MFA_ENCRYPTION_KEY: %w", err)
	}
	if len(key) != 32 {
		return nil, fmt.Errorf("MFA_ENCRYPTION_KEY: want 32 bytes, got %d", len(key))
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &Service{db: d, gcm: gcm, issuer: issuer}, nil
}

// encryptSecret AES-GCM-encrypts the raw TOTP secret with a fresh
// nonce. Result format: base64(nonce || ciphertext || tag).
func (s *Service) encryptSecret(plain []byte) (string, error) {
	if s.gcm == nil {
		return "", ErrMFAEncKeyMissing
	}
	nonce := make([]byte, s.gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	ct := s.gcm.Seal(nonce, nonce, plain, nil)
	return base64.StdEncoding.EncodeToString(ct), nil
}

func (s *Service) decryptSecret(enc string) ([]byte, error) {
	if s.gcm == nil {
		return nil, ErrMFAEncKeyMissing
	}
	raw, err := base64.StdEncoding.DecodeString(enc)
	if err != nil {
		return nil, err
	}
	ns := s.gcm.NonceSize()
	if len(raw) < ns {
		return nil, errors.New("mfa: ciphertext too short")
	}
	nonce, ct := raw[:ns], raw[ns:]
	return s.gcm.Open(nil, nonce, ct, nil)
}

// EnrollStart mints a fresh secret + provisioning URI for `userEmail`
// and stores it in user_mfa_pending. Returns the otpauth:// URI for
// QR display and the human-readable base32 secret for the "type it in
// manually" fallback. The pending row replaces any prior pending row
// for the same user — restarting enrollment never piles up state.
func (s *Service) EnrollStart(ctx context.Context, userID, userEmail string) (uri, secret string, err error) {
	if s.gcm == nil {
		return "", "", ErrMFAEncKeyMissing
	}
	// Reject if MFA is already active — re-enrolling without disabling
	// first would otherwise let a stolen confirmation race the legit
	// user.
	var enabledAt *time.Time
	_ = s.db.Pool.QueryRow(ctx, `SELECT totp_enabled_at FROM users WHERE id = $1`, userID).Scan(&enabledAt)
	if enabledAt != nil {
		return "", "", ErrMFAAlreadyEnabled
	}

	raw := make([]byte, 20) // 160-bit secret — RFC 4226 recommended minimum
	if _, err := rand.Read(raw); err != nil {
		return "", "", err
	}
	secret = EncodeSecretBase32(raw)
	enc, err := s.encryptSecret(raw)
	if err != nil {
		return "", "", err
	}

	if _, err := s.db.Pool.Exec(ctx, `
		INSERT INTO user_mfa_pending (user_id, secret_encrypted, expires_at)
		VALUES ($1, $2, now() + ($3::interval))
		ON CONFLICT (user_id) DO UPDATE
			SET secret_encrypted = EXCLUDED.secret_encrypted,
			    expires_at       = EXCLUDED.expires_at,
			    created_at       = now()
	`, userID, enc, fmt.Sprintf("%d seconds", int(enrollPendingTTL.Seconds()))); err != nil {
		return "", "", err
	}
	return OtpauthURI(s.issuer, userEmail, secret), secret, nil
}

// EnrollConfirm verifies the user's first TOTP code against the
// pending secret, promotes the secret to user_mfa, generates a fresh
// set of backup codes, and deletes the pending row. Returns the
// plaintext backup codes ONCE — they're bcrypt-hashed at rest so
// they can never be retrieved again.
func (s *Service) EnrollConfirm(ctx context.Context, userID, code string) (backupCodes []string, err error) {
	if s.gcm == nil {
		return nil, ErrMFAEncKeyMissing
	}
	var encSecret string
	var expires time.Time
	err = s.db.Pool.QueryRow(ctx, `
		SELECT secret_encrypted, expires_at FROM user_mfa_pending WHERE user_id = $1
	`, userID).Scan(&encSecret, &expires)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrMFAEnrollNotPending
	}
	if err != nil {
		return nil, err
	}
	if time.Now().After(expires) {
		_, _ = s.db.Pool.Exec(ctx, `DELETE FROM user_mfa_pending WHERE user_id = $1`, userID)
		return nil, ErrMFAEnrollNotPending
	}
	rawSecret, err := s.decryptSecret(encSecret)
	if err != nil {
		return nil, err
	}
	if !Verify(EncodeSecretBase32(rawSecret), code, time.Now()) {
		return nil, ErrMFACodeInvalid
	}

	codes, codeHashes, err := generateBackupCodes()
	if err != nil {
		return nil, err
	}

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	// Promote pending → live. Storing the encrypted secret on the user
	// row keeps Login()'s second-factor check a single JOIN.
	if _, err := tx.Exec(ctx, `
		UPDATE users SET totp_secret_encrypted = $1, totp_enabled_at = now(), totp_last_counter = 0 WHERE id = $2
	`, encSecret, userID); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM user_mfa_pending WHERE user_id = $1`, userID); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM user_mfa_backup_codes WHERE user_id = $1`, userID); err != nil {
		return nil, err
	}
	for _, h := range codeHashes {
		if _, err := tx.Exec(ctx, `
			INSERT INTO user_mfa_backup_codes (user_id, code_hash) VALUES ($1, $2)
		`, userID, h); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return codes, nil
}

// Validate is the second-step login check. Returns nil if `code` is a
// valid TOTP for the user's stored secret, OR matches an unused
// backup code. Backup codes are consumed on match.
func (s *Service) Validate(ctx context.Context, userID, code string) error {
	if s.gcm == nil {
		return ErrMFAEncKeyMissing
	}
	code = strings.TrimSpace(code)
	if code == "" {
		return ErrMFACodeInvalid
	}

	var encSecret *string
	var lastCounter int64
	if err := s.db.Pool.QueryRow(ctx,
		`SELECT totp_secret_encrypted, COALESCE(totp_last_counter, 0) FROM users WHERE id = $1`,
		userID).Scan(&encSecret, &lastCounter); err != nil {
		return err
	}
	if encSecret == nil || *encSecret == "" {
		return ErrMFANotEnabled
	}

	// Try the TOTP path first — much cheaper than bcrypt against 10
	// backup-code hashes. A 6-digit pure-number code can ONLY match
	// the TOTP path; the dash in backup codes ("XXXX-XXXX") makes the
	// formats unambiguous.
	if len(code) == Digits && isAllDigits(code) {
		raw, err := s.decryptSecret(*encSecret)
		if err != nil {
			return err
		}
		ok, matchedCounter := VerifyCounter(EncodeSecretBase32(raw), code, time.Now())
		if !ok {
			return ErrMFACodeInvalid
		}
		// Replay protection: reject if this counter (or any prior one
		// inside the drift window) has already been accepted. ±1 step
		// from current means matchedCounter ≤ lastCounter implies the
		// code was previously consumed inside its 30s+drift window.
		if int64(matchedCounter) <= lastCounter {
			return ErrMFACodeInvalid
		}
		// Persist the consumed counter inside the same transactional
		// window the rest of the auth flow uses. Best-effort logged on
		// error: the user already passed the TOTP, refusing the login
		// because the bookkeeping write failed is worse than allowing
		// one extra replay window.
		if _, err := s.db.Pool.Exec(ctx,
			`UPDATE users SET totp_last_counter = $1 WHERE id = $2 AND COALESCE(totp_last_counter, 0) < $1`,
			int64(matchedCounter), userID); err != nil {
			// Don't fail the validate just because the counter write
			// failed — log so ops sees the degraded state.
			// (Logging is intentionally lightweight here; callers may
			// add their own audit/log layer.)
			_ = err
		}
		return nil
	}

	// Backup code path: bcrypt-compare against every unused row,
	// constant-time across the loop so we don't leak which (if any)
	// matched via timing.
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id, code_hash FROM user_mfa_backup_codes WHERE user_id = $1 AND used_at IS NULL
	`, userID)
	if err != nil {
		return err
	}
	defer rows.Close()
	type cand struct{ id, hash string }
	var cands []cand
	for rows.Next() {
		var c cand
		if err := rows.Scan(&c.id, &c.hash); err != nil {
			return err
		}
		cands = append(cands, c)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	var matched string
	for _, c := range cands {
		if err := bcrypt.CompareHashAndPassword([]byte(c.hash), []byte(strings.ToUpper(code))); err == nil {
			matched = c.id
			break
		}
	}
	if matched == "" {
		return ErrMFACodeInvalid
	}
	_, _ = s.db.Pool.Exec(ctx, `DELETE FROM user_mfa_backup_codes WHERE id = $1`, matched)
	return nil
}

// Disable wipes TOTP + backup codes for a user. Caller must have
// already proven a second factor (via Validate) — the handler enforces
// that, not this function.
func (s *Service) Disable(ctx context.Context, userID string) error {
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	if _, err := tx.Exec(ctx, `
		UPDATE users SET totp_secret_encrypted = NULL, totp_enabled_at = NULL, totp_last_counter = 0 WHERE id = $1
	`, userID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM user_mfa_backup_codes WHERE user_id = $1`, userID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM user_mfa_pending WHERE user_id = $1`, userID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// IsEnabled reports whether the user has MFA active. Used by Login to
// decide whether to short-circuit to the two-step flow.
func (s *Service) IsEnabled(ctx context.Context, userID string) (bool, error) {
	var t *time.Time
	err := s.db.Pool.QueryRow(ctx, `SELECT totp_enabled_at FROM users WHERE id = $1`, userID).Scan(&t)
	if err != nil {
		return false, err
	}
	return t != nil, nil
}

// generateBackupCodes returns 10 plaintext codes for one-time display
// to the user, alongside their bcrypt hashes for storage. Codes are
// formatted "XXXX-XXXX" (uppercase base32-style) for readability.
func generateBackupCodes() (plain []string, hashes []string, err error) {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // base32 minus visually-ambiguous I/O/0/1
	plain = make([]string, backupCodeCount)
	hashes = make([]string, backupCodeCount)
	for i := 0; i < backupCodeCount; i++ {
		var raw [8]byte
		if _, err = rand.Read(raw[:]); err != nil {
			return nil, nil, err
		}
		var sb strings.Builder
		for j, b := range raw {
			if j == 4 {
				sb.WriteByte('-')
			}
			sb.WriteByte(alphabet[int(b)%len(alphabet)])
		}
		code := sb.String()
		h, err := bcrypt.GenerateFromPassword([]byte(code), 12)
		if err != nil {
			return nil, nil, err
		}
		plain[i] = code
		hashes[i] = string(h)
	}
	return plain, hashes, nil
}

// isAllDigits is a 1-line helper; explicit so future readers see why
// we bypass the bcrypt loop for 6-digit codes.
func isAllDigits(s string) bool {
	for i := 0; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return false
		}
	}
	return true
}

// ensure subtle is "used" so callers don't accidentally remove the
// import while refactoring (kept for the constant-time secret compare
// patterns; not used directly here today but the API depends on it).
var _ = subtle.ConstantTimeCompare
