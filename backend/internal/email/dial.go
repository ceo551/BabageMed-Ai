package email

import (
	"context"
	"net"
	"net/smtp"
	"time"
)

// withTimeout returns ctx if it already has a deadline shorter than
// `d`, else ctx wrapped in a fresh `d`-bounded deadline. Used so an
// upstream cancellation (request ctx) still applies but a missing
// deadline doesn't let the SMTP dial hang forever.
func withTimeout(ctx context.Context, d time.Duration) (context.Context, context.CancelFunc) {
	if dl, ok := ctx.Deadline(); ok && time.Until(dl) < d {
		return ctx, func() {}
	}
	return context.WithTimeout(ctx, d)
}

func newDeadline(ctx context.Context) time.Time {
	if dl, ok := ctx.Deadline(); ok {
		return dl
	}
	return time.Now().Add(15 * time.Second)
}

// dialSMTP opens an SMTP connection respecting the supplied deadline.
// Wrapped here because smtp.Dial doesn't expose a deadline / context.
func dialSMTP(addr string, deadline time.Time) (*smtp.Client, error) {
	d := &net.Dialer{Deadline: deadline}
	conn, err := d.Dial("tcp", addr)
	if err != nil {
		return nil, err
	}
	_ = conn.SetDeadline(deadline)
	host := addr
	if i := lastIndex(addr, ':'); i >= 0 {
		host = addr[:i]
	}
	return smtp.NewClient(conn, host)
}

func lastIndex(s string, b byte) int {
	for i := len(s) - 1; i >= 0; i-- {
		if s[i] == b {
			return i
		}
	}
	return -1
}
