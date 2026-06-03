package payments

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/pervagans/backend/internal/db"
	"github.com/jackc/pgx/v5"
)

// Store records payment intents and updates them when webhooks confirm them.
// Wired into the Paddle handler when a *db.DB is provided.
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
// payments row, NOT from the planID argument. A webhook may arrive with an
// empty planID, so trusting the argument would downgrade every paying user
// to "free" via the default branch of planFromPlanID(""). Looking it up
// RETURNING is self-healing: the value was already recorded at checkout time.
func (s *Store) MarkPaid(ctx context.Context, provider, externalID, userID, planID string) error {
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

	var uidPtr *string
	if userID != "" {
		uidPtr = &userID
	}

	var rowUser *string
	var rowPlanID string
	// Flip an existing (pending) row to paid if present. Idempotent: the
	// `status IS DISTINCT FROM 'paid'` guard means a replayed webhook doesn't
	// re-run the upgrade.
	err = tx.QueryRow(ctx, `
        UPDATE payments SET status = 'paid'
        WHERE provider = $1 AND external_id = $2
          AND status IS DISTINCT FROM 'paid'
        RETURNING user_id, COALESCE(plan_id, '')
    `, provider, externalID).Scan(&rowUser, &rowPlanID)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		// No pending row: either already paid (replay) OR a recurring renewal
		// whose transaction id we've never seen (each month is a new id). Insert
		// a paid ledger row so renewals after month one aren't silently lost;
		// ON CONFLICT keeps the replay case a clean no-op.
		var amount int64
		if p, ok := GetPlan(planID); ok {
			amount = p.USD
		}
		if _, ierr := tx.Exec(ctx, `
            INSERT INTO payments (user_id, provider, external_id, plan_id, amount_minor, currency, status)
            VALUES ($1, $2, $3, NULLIF($4, ''), $5, 'USD', 'paid')
            ON CONFLICT (provider, external_id) DO NOTHING
        `, uidPtr, provider, externalID, planID, amount); ierr != nil {
			return ierr
		}
		rowUser = uidPtr
		rowPlanID = planID
	case err != nil:
		return err
	}

	// Upgrade the user's plan — prefer the persisted plan_id, fall back to the
	// webhook's custom_data plan id (renewals / legacy rows).
	effUser := rowUser
	if effUser == nil {
		effUser = uidPtr
	}
	effPlan := rowPlanID
	if effPlan == "" {
		effPlan = planID
	}
	if effUser != nil && effPlan != "" {
		if _, err := tx.Exec(ctx, `UPDATE users SET plan = $1 WHERE id = $2`, planFromPlanID(effPlan), *effUser); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// SetPlanFree downgrades a user to the free plan. Called on
// cancel/refund/past-due/payment-failed webhooks so paid access doesn't persist
// indefinitely after billing stops (the revenue-leak fix). Idempotent.
func (s *Store) SetPlanFree(ctx context.Context, userID string) error {
	if s == nil || s.DB == nil || userID == "" {
		return nil
	}
	_, err := s.DB.Pool.Exec(ctx, `UPDATE users SET plan = 'free' WHERE id = $1`, userID)
	return err
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
