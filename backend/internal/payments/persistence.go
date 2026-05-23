package payments

import (
	"context"
	"encoding/json"

	"github.com/babagemed/backend/internal/db"
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

// MarkPaid + bump user's plan if user is linked.
func (s *Store) MarkPaid(ctx context.Context, provider, externalID, planID string) error {
	if s == nil || s.DB == nil {
		return nil
	}
	tx, err := s.DB.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var userID *string
	err = tx.QueryRow(ctx, `
        UPDATE payments SET status = 'paid'
        WHERE provider = $1 AND external_id = $2
        RETURNING user_id
    `, provider, externalID).Scan(&userID)
	if err != nil {
		return err
	}
	if userID != nil {
		if _, err := tx.Exec(ctx, `UPDATE users SET plan = $1 WHERE id = $2`, planFromPlanID(planID), *userID); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func planFromPlanID(planID string) string {
	switch planID {
	case "max_monthly", "max_yearly":
		return "max"
	case "pro_monthly":
		return "pro"
	default:
		return "free"
	}
}
