package email

import (
	"context"
	"strings"
	"testing"
)

// CRLF injection on the subject line would let a malicious caller
// add Cc/Bcc/etc and turn the reset endpoint into an SMTP relay.
// sanitiseHeader must collapse both \r and \n before they ever hit
// the wire.
func TestSanitiseHeader_StripsCRLF(t *testing.T) {
	in := "Subject\r\nBcc: attacker@evil.com\r\nCc: another@evil.com"
	out := sanitiseHeader(in)
	if strings.Contains(out, "\r") || strings.Contains(out, "\n") {
		t.Errorf("sanitiseHeader left CRLF in output: %q", out)
	}
	if !strings.HasPrefix(out, "Subject") {
		t.Errorf("sanitiseHeader removed prefix: %q", out)
	}
}

func TestSanitiseHeader_LengthCap(t *testing.T) {
	long := strings.Repeat("a", 500)
	out := sanitiseHeader(long)
	if len(out) > 200 {
		t.Errorf("sanitiseHeader didn't cap length: got %d", len(out))
	}
}

// The RecorderSender lets tests assert "this flow sent an email
// containing the reset token". Confirm it preserves order + content.
func TestRecorderSender_Captures(t *testing.T) {
	r := &RecorderSender{}
	_ = r.Send(context.Background(), Message{To: "a@x", Subject: "s1", Body: "hi"})
	_ = r.Send(context.Background(), Message{To: "b@x", Subject: "s2", Body: "ok"})
	msgs := r.Messages()
	if len(msgs) != 2 || msgs[0].To != "a@x" || msgs[1].Subject != "s2" {
		t.Errorf("recorder messages mismatch: %+v", msgs)
	}
}

// ConsoleSender must never error — it's the dev fallback used when
// no SMTP config is present, and an error here would break the
// reset / verify handlers in local dev.
func TestConsoleSender_NeverErrors(t *testing.T) {
	if err := (ConsoleSender{}).Send(context.Background(), Message{To: "x", Subject: "y", Body: "z"}); err != nil {
		t.Errorf("ConsoleSender.Send returned err: %v", err)
	}
}
