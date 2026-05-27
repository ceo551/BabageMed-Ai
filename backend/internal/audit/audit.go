// Package audit — append-only record of sensitive mutations.
//
// Calling sites are deliberately fire-and-forget: a failed audit insert
// must NEVER block the underlying operation (otherwise a Postgres blip
// becomes an admin-panel outage). Errors are logged so an operator can
// notice if audit writes start failing systemically, but the calling
// handler still returns success.
package audit

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

	"github.com/babagemed/backend/internal/db"
)

type Service struct {
	db *db.DB
}

func New(d *db.DB) *Service { return &Service{db: d} }

// Record writes a single audit entry. actorID / targetID are optional
// (empty string → NULL in the DB). details is marshalled to JSONB; a
// nil map records SQL NULL. Never returns an error — failures are
// logged. See package doc for why.
func (s *Service) Record(ctx context.Context, r *http.Request, actorID, targetID, action string, details map[string]any) {
	if s == nil || s.db == nil {
		return
	}
	var ip, ua string
	if r != nil {
		ua = r.UserAgent()
		ip = clientIPFromRequest(r)
	}
	var detailsJSON []byte
	if len(details) > 0 {
		b, err := json.Marshal(details)
		if err != nil {
			// Marshal failure means our details map has an unmarshalable
			// value (function, channel) — that's a code bug in the
			// calling site, not user input. Log + drop the details
			// but still record the action so the audit trail isn't lost.
			log.Printf("audit: details marshal failed for %q: %v", action, err)
		} else {
			detailsJSON = b
		}
	}
	var actorArg, targetArg any
	if actorID != "" {
		actorArg = actorID
	}
	if targetID != "" {
		targetArg = targetID
	}
	_, err := s.db.Pool.Exec(ctx, `
		INSERT INTO audit_log (actor_id, target_id, action, details, ip, user_agent)
		VALUES ($1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''))
	`, actorArg, targetArg, action, detailsJSON, ip, ua)
	if err != nil {
		log.Printf("audit: insert failed for action=%q target=%q: %v", action, targetID, err)
	}
}

// clientIPFromRequest mirrors ratelimit.clientIP — leftmost XFF claim
// (overwritten by our trusted ingress on entry) or RemoteAddr.
// Duplicated rather than depended-on so the audit package stays a leaf
// (no circular imports if ratelimit later wants to log to audit).
func clientIPFromRequest(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		for i := 0; i < len(xff); i++ {
			if xff[i] == ',' {
				return trimSpace(xff[:i])
			}
		}
		return trimSpace(xff)
	}
	addr := r.RemoteAddr
	for i := len(addr) - 1; i >= 0; i-- {
		if addr[i] == ':' {
			return addr[:i]
		}
	}
	return addr
}

func trimSpace(s string) string {
	for len(s) > 0 && (s[0] == ' ' || s[0] == '\t') {
		s = s[1:]
	}
	for len(s) > 0 && (s[len(s)-1] == ' ' || s[len(s)-1] == '\t') {
		s = s[:len(s)-1]
	}
	return s
}
