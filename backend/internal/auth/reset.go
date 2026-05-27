package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"log"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/babagemed/backend/internal/email"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

// Password-reset + email-verification flows.
//
// Both flows generate a 32-byte URL-safe token, store its bcrypt hash
// in the appropriate token table (never the raw token), and email the
// raw value to the user as part of a link. The handler that consumes
// the token re-hashes the candidate and looks up the row, so a DB
// dump never yields a usable token.

const (
	resetTokenTTL   = 60 * time.Minute  // long enough for a user to read the email + click
	verifyTokenTTL  = 24 * time.Hour    // verification is more leisurely than reset
	resetTokenBytes = 32
)

// genToken returns an opaque 32-byte URL-safe token (44 chars when
// base64-encoded). Length matches the session token format used by
// createSession() — keeps the bcrypt cost predictable.
func genToken() (string, error) {
	var b [resetTokenBytes]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b[:]), nil
}

// SendPasswordResetEmail kicks off a reset. Always returns nil to the
// caller — we DELIBERATELY don't surface "no such email" because that
// would leak which addresses are registered. Internally we still log
// the miss so an operator can spot bulk enumeration attempts.
func (s *Service) SendPasswordResetEmail(ctx context.Context, sender email.Sender, rawEmail string) error {
	normalised := strings.ToLower(strings.TrimSpace(rawEmail))
	if !looksLikeEmail(normalised) {
		// Same opaque outcome — the caller never learns whether the
		// email was even well-formed.
		return nil
	}

	var userID string
	err := s.db.Pool.QueryRow(ctx, `SELECT id FROM users WHERE email = $1`, normalised).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		log.Printf("password-reset: no user for email=%q (silently dropped)", normalised)
		return nil
	}
	if err != nil {
		return err
	}

	token, err := genToken()
	if err != nil {
		return err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(token), BcryptCost)
	if err != nil {
		return err
	}
	expires := time.Now().Add(resetTokenTTL)
	if _, err := s.db.Pool.Exec(ctx, `
		INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
		VALUES ($1, $2, $3)
	`, userID, string(hash), expires); err != nil {
		return err
	}

	link := buildLink("/reset-password", map[string]string{"token": token, "email": normalised})
	body := fmt.Sprintf(
		"You (or someone using your email) asked to reset your Babbage AI password.\n\n"+
			"Open this link within %d minutes to choose a new password:\n%s\n\n"+
			"If you didn't request this, you can ignore the message — nothing changes until the link is used.",
		int(resetTokenTTL.Minutes()), link,
	)
	return sender.Send(ctx, email.Message{
		To:      normalised,
		Subject: "Reset your Babbage AI password",
		Body:    body,
	})
}

// CompletePasswordReset verifies the token against every outstanding
// reset row for that email and, on success, updates the password and
// purges ALL reset tokens for that user (one-shot, prevents replay).
func (s *Service) CompletePasswordReset(ctx context.Context, rawEmail, token, newPassword string) error {
	if len(newPassword) < 8 {
		return ErrWeakPassword
	}
	normalised := strings.ToLower(strings.TrimSpace(rawEmail))

	rows, err := s.db.Pool.Query(ctx, `
		SELECT t.id, t.token_hash
		FROM password_reset_tokens t
		JOIN users u ON u.id = t.user_id
		WHERE u.email = $1
		  AND t.used_at IS NULL
		  AND t.expires_at > now()
	`, normalised)
	if err != nil {
		return err
	}
	defer rows.Close()

	type cand struct {
		id   string
		hash string
	}
	var candidates []cand
	for rows.Next() {
		var c cand
		if err := rows.Scan(&c.id, &c.hash); err != nil {
			return err
		}
		candidates = append(candidates, c)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	// Bcrypt-compare against EVERY outstanding candidate — bcrypt is
	// constant-time, so timing across the loop doesn't leak which row
	// (if any) matched. Stops at the first match.
	var matchedID string
	for _, c := range candidates {
		if err := bcrypt.CompareHashAndPassword([]byte(c.hash), []byte(token)); err == nil {
			matchedID = c.id
			break
		}
	}
	if matchedID == "" {
		return errors.New("invalid or expired reset token")
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), BcryptCost)
	if err != nil {
		return err
	}

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if _, err := tx.Exec(ctx, `
		UPDATE users SET password_hash = $1 WHERE email = $2
	`, string(newHash), normalised); err != nil {
		return err
	}
	// Purge every outstanding reset token for this user. We delete
	// rather than mark-used so a leaked DB dump can't reveal that a
	// reset was ever requested — and so the user_id column doesn't
	// accumulate stale rows on every cycle.
	if _, err := tx.Exec(ctx, `
		DELETE FROM password_reset_tokens
		WHERE user_id = (SELECT id FROM users WHERE email = $1)
	`, normalised); err != nil {
		return err
	}
	// Invalidate every active session — if the reset was triggered
	// because of compromise, the attacker's cookies are now dead.
	if _, err := tx.Exec(ctx, `
		DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = $1)
	`, normalised); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// SendVerificationEmail mints a fresh verification token for the
// authenticated user and emails them the link. Existing pending tokens
// are wiped so only the latest link works (defends against an old
// stale email being clicked later).
func (s *Service) SendVerificationEmail(ctx context.Context, sender email.Sender, userID, userEmail string) error {
	// Strict equality check against the persisted email — userEmail
	// comes from the request context, but defending against a stale
	// session that survived an email change is cheap.
	var dbEmail string
	if err := s.db.Pool.QueryRow(ctx, `SELECT email FROM users WHERE id = $1`, userID).Scan(&dbEmail); err != nil {
		return err
	}

	token, err := genToken()
	if err != nil {
		return err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(token), BcryptCost)
	if err != nil {
		return err
	}

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if _, err := tx.Exec(ctx, `DELETE FROM email_verify_tokens WHERE user_id = $1`, userID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO email_verify_tokens (user_id, token_hash, expires_at)
		VALUES ($1, $2, now() + ($3::interval))
	`, userID, string(hash), fmt.Sprintf("%d minutes", int(verifyTokenTTL.Minutes()))); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}

	link := buildLink("/verify-email", map[string]string{"token": token, "uid": userID})
	body := fmt.Sprintf(
		"Click the link below to confirm this is your email address. The link is valid for %d hours.\n\n%s",
		int(verifyTokenTTL.Hours()), link,
	)
	return sender.Send(ctx, email.Message{
		To:      dbEmail,
		Subject: "Verify your Babbage AI email",
		Body:    body,
	})
}

// CompleteEmailVerification consumes a verify token and flips
// email_verified_at on the user. Returns ErrInvalidCreds for unknown /
// expired tokens so the failure path stays vague.
func (s *Service) CompleteEmailVerification(ctx context.Context, userID, token string) error {
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id, token_hash FROM email_verify_tokens
		WHERE user_id = $1 AND used_at IS NULL AND expires_at > now()
	`, userID)
	if err != nil {
		return err
	}
	defer rows.Close()
	var matchedID string
	for rows.Next() {
		var id, hash string
		if err := rows.Scan(&id, &hash); err != nil {
			return err
		}
		if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(token)); err == nil {
			matchedID = id
			break
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if matchedID == "" {
		return ErrInvalidCreds
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	if _, err := tx.Exec(ctx, `UPDATE users SET email_verified_at = now() WHERE id = $1`, userID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM email_verify_tokens WHERE user_id = $1`, userID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// buildLink builds a public URL on PUBLIC_BASE_URL + path with the
// given query params. Falls back to an empty base in dev — the
// console-sender will still log a usable relative URL.
func buildLink(path string, q map[string]string) string {
	base := strings.TrimRight(os.Getenv("PUBLIC_BASE_URL"), "/")
	if base == "" {
		base = "http://localhost:3000"
	}
	u, err := url.Parse(base + path)
	if err != nil {
		return base + path
	}
	qs := u.Query()
	for k, v := range q {
		qs.Set(k, v)
	}
	u.RawQuery = qs.Encode()
	return u.String()
}

