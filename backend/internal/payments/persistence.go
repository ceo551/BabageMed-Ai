package payments

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/babbage/backend/internal/db"
	"github.com/jackc/pgx/v5"
)

// Store records payment intents and updates them when webhooks confirm them.
// Wired into the existing Paymob + PayPal handlers when a *db.DB is provided.
type Store struct{ DB *db.DB }

func NewStore(d *db.DB) *Store { return &Store{DB: d} }

// Record creates or upserts a payment row keyed by (provider, external_id).
func (s *Store) Record(ctx context.Context, userID *string, provider, externalID, planID string, amountMinor int64, currency, status string, raw any) error {
	if s == nil || s.DB == nil {
		return nil
	}
	var rawBytes []byte
	if raw != nil {
		rawBytes, _ = json.Marshal(raw)
	}
	_, err := s.DB.Pool.Exec(ctx, `
        INSERT INTO payments (user_id, provider, external_id, plan_id, amount_minor, currency, status, raw)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        ON CONFLICT (provider, external_id) DO UPDATE
            SET status = EXCLUDED.status, raw = EXCLUDED.raw
    `, userID, provider, externalID, planID, amountMinor, currency, status, string(rawBytes))
	return err
}

// MarkPaid flips a payment row to "paid" and bumps the linked user's plan.
//
// IMPORTANT: the user's plan is derived from the persisted `plan_id` on the
// payments row, NOT from the planID argument. The Paymob webhook is fired
// with no planID (the upstream payload doesn't carry it), so trusting the
// argument would downgrade every paying user to "free" via the default
// branch of planFromPlanID(""). Looking it up RETURNING is self-healing:
// the value was already recorded at checkout time.
func (s *Store) MarkPaid(ctx context.Context, provider, externalID, planID string) error {
	if s == nil || s.DB == nil {
		return nil
	}
	tx, err := s.DB.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	// Rollback uses a fresh context: the request context may already be
	// cancelled if the webhook caller hung up, and pgx requires a live ctx
	// to send the rollback message — otherwise the connection is dropped
	// into the pool in a half-broken state.
	defer func() {
		rbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = tx.Rollback(rbCtx)
	}()

	var userID *string
	var rowPlanID string
	// Idempotent: only flip the row if it's NOT already paid. A replayed
	// webhook (Paymob and PayPal both retry on 5xx) would otherwise
	// re-run the plan upgrade below — harmless today because the
	// upgrade is itself idempotent, but it stays dangerous if the plan
	// logic ever grows side effects (credits, emails, slack pings).
	err = tx.QueryRow(ctx, `
        UPDATE payments SET status = 'paid'
        WHERE provider = $1 AND external_id = $2
          AND status IS DISTINCT FROM 'paid'
        RETURNING user_id, COALESCE(plan_id, '')
    `, provider, externalID).Scan(&userID, &rowPlanID)
	if errors.Is(err, pgx.ErrNoRows) {
		// Already paid (or row doesn't exist). Commit the empty tx and
		// return cleanly so the webhook handler responds 200 — without
		// a 200, the provider will keep retrying.
		return tx.Commit(ctx)
	}
	if err != nil {
		return err
	}
	// Fall back to the argument only if the persisted value is empty
	// (legacy rows from before this column was populated).
	effective := rowPlanID
	if effective == "" {
		effective = planID
	}
	if userID != nil && effective != "" {
		if _, err := tx.Exec(ctx, `UPDATE users SET plan = $1 WHERE id = $2`, planFromPlanID(effective), *userID); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func planFromPlanID(planID string) string {
	switch planID {
	case "max_monthly":
		return "max"
	case "pro_monthly":
		return "pro"
	case "plus_monthly":
		return "plus"
	case "go_monthly":
		return "go"
	default:
		return "free"
	}
}
