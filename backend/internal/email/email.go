// Package email — transactional email sender used by password reset
// and email verification. Designed as a thin interface with two
// pluggable drivers:
//
//   - smtp:    real SMTP for prod (any provider — SES, Mailgun, Postmark,
//              SendGrid all support SMTP submission).
//   - console: dev-only — logs the message body to stderr so a developer
//              running locally without SMTP creds can still test the
//              reset / verify flows end-to-end.
//
// Driver selection is keyed off env vars at construction (NewFromEnv).
// Callers receive a Sender interface, so a test can swap in an
// in-memory recorder without touching the production wiring.
package email

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"log"
	"net/smtp"
	"os"
	"strings"
	"sync"
	"time"
)

// Message is the minimal email envelope this package supports. We
// avoid HTML for now — every flow ships a short plain-text body that
// renders fine in every client without an HTML renderer in the
// middle. Adding HTML later is a one-field extension; designing it
// upfront just for hypothetical future templates is overkill.
type Message struct {
	To      string
	Subject string
	Body    string
}

// Sender is the surface every driver implements. Send returns an
// error on transport failure; success means the email is queued with
// the upstream, not delivered.
type Sender interface {
	Send(ctx context.Context, m Message) error
}

// ConsoleSender prints messages to stderr — useful in dev. Also kept
// as the fallback driver when SMTP env vars aren't set so a deploy
// without email config doesn't crash, it just loses the messages
// (with a noisy log line so an operator notices).
type ConsoleSender struct{}

func (ConsoleSender) Send(_ context.Context, m Message) error {
	log.Printf("email/console: To=%q Subject=%q\nBody:\n%s", m.To, m.Subject, m.Body)
	return nil
}

// RecorderSender keeps every sent message in memory — for unit tests
// that want to assert "this flow sent a reset email containing token X".
type RecorderSender struct {
	mu       sync.Mutex
	messages []Message
}

func (r *RecorderSender) Send(_ context.Context, m Message) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.messages = append(r.messages, m)
	return nil
}
func (r *RecorderSender) Messages() []Message {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]Message, len(r.messages))
	copy(out, r.messages)
	return out
}

// SMTPSender uses net/smtp PLAIN auth over STARTTLS. Connection is
// per-message (no pool) — transactional volume here is low (a few
// hundred sends per day at most) and a per-message dial keeps the
// failure mode simple: every call either succeeds or fails on its own.
type SMTPSender struct {
	Host string // smtp.example.com:587
	From string
	User string
	Pass string
}

func (s *SMTPSender) Send(ctx context.Context, m Message) error {
	if s.Host == "" || s.From == "" {
		return errors.New("smtp: host/from not configured")
	}
	// Per-call dial with a deadline so a hung upstream doesn't block
	// the caller goroutine forever — important because reset / verify
	// handlers run synchronously.
	ctx, cancel := withTimeout(ctx, 15*time.Second)
	defer cancel()

	hostOnly := s.Host
	if i := strings.IndexByte(hostOnly, ':'); i >= 0 {
		hostOnly = hostOnly[:i]
	}

	d := newDeadline(ctx)
	c, err := dialSMTP(s.Host, d)
	if err != nil {
		return err
	}
	defer c.Close()

	if ok, _ := c.Extension("STARTTLS"); ok {
		if err := c.StartTLS(&tls.Config{ServerName: hostOnly, MinVersion: tls.VersionTLS12}); err != nil {
			return err
		}
	}
	if s.User != "" {
		auth := smtp.PlainAuth("", s.User, s.Pass, hostOnly)
		if err := c.Auth(auth); err != nil {
			return err
		}
	}
	if err := c.Mail(s.From); err != nil {
		return err
	}
	if err := c.Rcpt(m.To); err != nil {
		return err
	}
	wc, err := c.Data()
	if err != nil {
		return err
	}
	headers := strings.Join([]string{
		"From: " + s.From,
		"To: " + m.To,
		"Subject: " + sanitiseHeader(m.Subject),
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=utf-8",
	}, "\r\n")
	if _, err := fmt.Fprintf(wc, "%s\r\n\r\n%s", headers, m.Body); err != nil {
		_ = wc.Close()
		return err
	}
	if err := wc.Close(); err != nil {
		return err
	}
	return c.Quit()
}

// sanitiseHeader keeps a single-line header value safe from CRLF
// injection (an attacker who controls the subject could otherwise
// inject extra headers — Cc, Bcc — and turn the reset endpoint into
// an open relay against the upstream SMTP server).
func sanitiseHeader(s string) string {
	s = strings.ReplaceAll(s, "\r", " ")
	s = strings.ReplaceAll(s, "\n", " ")
	if len(s) > 200 {
		s = s[:200]
	}
	return s
}

// NewFromEnv picks a driver based on env vars:
//   SMTP_HOST + SMTP_FROM set → SMTPSender (with optional SMTP_USER /
//                                SMTP_PASS for auth)
//   otherwise                   → ConsoleSender (with a one-line warning)
func NewFromEnv() Sender {
	host := os.Getenv("SMTP_HOST")
	from := os.Getenv("SMTP_FROM")
	if host == "" || from == "" {
		log.Printf("email: SMTP_HOST / SMTP_FROM not set — using console driver (emails will be logged, not sent)")
		return ConsoleSender{}
	}
	return &SMTPSender{
		Host: host,
		From: from,
		User: os.Getenv("SMTP_USER"),
		Pass: os.Getenv("SMTP_PASS"),
	}
}
