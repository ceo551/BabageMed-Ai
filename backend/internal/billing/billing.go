// Package billing — per-user usage metering + per-plan monthly credit caps.
//
// Why: Pervagans is a WRAPPER — it pays upstream model providers (Anthropic /
// OpenAI / DashScope) per token. Without a ceiling, a single logged-in user
// running unbounded agent runs / video generations / deep-research drains real
// money. Each plan (free/go/plus/pro/max) gets a monthly credit allowance; the
// expensive handlers Check() before proceeding and Record() after.
//
// Anonymous traffic is intentionally NOT metered here — it's already bounded by
// clampForAnon (cheapest model only, no web/MCP/agent/deep-research) plus the
// per-IP rate limiter. A hard anonymous cap belongs with the signed anon_id
// cookie of the trial surface (roadmap P4).
//
// Design: methods are nil-receiver-safe and FAIL-OPEN — a nil service, empty
// user, or a transient DB error returns "allowed" (logged), because a metering
// hiccup must never take down chat. We fail CLOSED only on a definitive
// over-budget result.
package billing

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/pervagans/backend/internal/auth"
	"github.com/pervagans/backend/internal/db"
	"github.com/go-chi/chi/v5"
)

// opCost is the credit weight of each metered operation. These are rough
// RELATIVE weights (video ≫ image ≫ agent ≈ deep-research ≫ chat), tuned to
// upstream cost — not exact billing. Unknown ops cost 1.
// opCost is the credit weight of each metered op, tuned so 1 credit ≈ $0.01 of
// upstream API cost (see plans.go / the pricing model). video ≫ image ≫ agent ≈
// deep-research ≫ chat. Unknown ops cost 1.
var opCost = map[string]int{
	"chat":          1,
	"deep_research": 3,
	"agent":         5,
	"image":         8,
	"video":         70,
}

// The monthly credit allowance per plan lives in plans.go (the single source of
// truth that also holds prices + the per-plan model matrix).

func costOf(op string) int {
	if c, ok := opCost[op]; ok {
		return c
	}
	return 1
}

func allowanceOf(plan string) int { return CreditsFor(plan) }

type Service struct {
	db   *db.DB
	auth *auth.Service
}

func New(d *db.DB, a *auth.Service) *Service { return &Service{db: d, auth: a} }

// Check reports whether `op` may proceed for this user in the current calendar
// month, plus the credits remaining. FAIL-OPEN (allowed, -1) on nil service /
// empty user / DB error; fail-CLOSED only when definitively over budget.
func (s *Service) Check(ctx context.Context, userID, plan, op string) (bool, int) {
	if s == nil || s.db == nil || userID == "" {
		return true, -1
	}
	used, err := s.usedThisMonth(ctx, userID)
	if err != nil {
		log.Printf("billing: check %v", err)
		return true, -1
	}
	limit := allowanceOf(plan)
	remaining := limit - used
	if remaining < 0 {
		remaining = 0
	}
	return used+costOf(op) <= limit, remaining
}

// AllowsModel reports whether this user's plan unlocks the given model id
// (plan-gating). nil-safe + fail-open so a nil service never blocks chat.
func (s *Service) AllowsModel(plan, model string) bool {
	if s == nil {
		return true
	}
	return AllowsModel(plan, model)
}

// Record logs consumed credits AFTER an operation is accepted. Charged on
// accept (not on upstream success) — same model as a rate-limited API. Uses a
// DETACHED context so the write survives a streaming client disconnecting.
func (s *Service) Record(userID, plan, op, model string) {
	if s == nil || s.db == nil || userID == "" {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := s.db.Pool.Exec(ctx, `
        INSERT INTO usage_ledger (user_id, operation, credits, model)
        VALUES ($1, $2, $3, NULLIF($4, ''))
    `, userID, op, costOf(op), model); err != nil {
		log.Printf("billing: record %v", err)
	}
}

// Refund reverses a Record for an op that ultimately failed (e.g. the upstream
// model errored before producing any answer) by inserting a negative-credit
// ledger row so the month's SUM nets back out. Best-effort, detached context.
// NOT for client mid-stream disconnects — partial tokens were delivered there.
func (s *Service) Refund(userID, op string) {
	if s == nil || s.db == nil || userID == "" {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := s.db.Pool.Exec(ctx, `
        INSERT INTO usage_ledger (user_id, operation, credits, model)
        VALUES ($1, $2, $3, NULL)
    `, userID, op, -costOf(op)); err != nil {
		log.Printf("billing: refund %v", err)
	}
}

func (s *Service) usedThisMonth(ctx context.Context, userID string) (int, error) {
	var sum int
	err := s.db.Pool.QueryRow(ctx, `
        SELECT COALESCE(SUM(credits), 0) FROM usage_ledger
        WHERE user_id = $1 AND created_at >= date_trunc('month', now())
    `, userID).Scan(&sum)
	return sum, err
}

// ─── HTTP: GET /api/usage ────────────────────────────────────────────────────

func (s *Service) Register(r chi.Router) {
	if s == nil || s.auth == nil {
		return
	}
	r.Group(func(gr chi.Router) {
		gr.Use(s.auth.Required)
		gr.Get("/api/usage", s.handleUsage)
	})
}

func (s *Service) handleUsage(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	plan := "free"
	used := 0
	if u != nil {
		if u.Plan != "" {
			plan = strings.ToLower(u.Plan)
		}
		if n, err := s.usedThisMonth(r.Context(), u.ID); err == nil {
			used = n
		}
	}
	limit := allowanceOf(plan)
	remaining := limit - used
	if remaining < 0 {
		remaining = 0
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"plan": plan, "used": used, "limit": limit, "remaining": remaining,
		"price": PriceFor(plan), "allowedModels": AllowedModels(plan),
	})
}
