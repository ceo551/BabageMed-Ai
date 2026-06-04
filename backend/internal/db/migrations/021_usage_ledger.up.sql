-- 021: usage ledger — per-user credit accounting for expensive operations
-- (chat / deep-research / agent / image / video). Wrapper economics: Pervagans
-- pays upstream model providers per token, so each plan gets a MONTHLY credit
-- allowance; the expensive handlers check the running total before proceeding
-- and record consumption after. "Used this month" = SUM(credits) since
-- date_trunc('month', now()) — computed on read, so there is no reset job.
-- Cascade-deletes with the user.
CREATE TABLE IF NOT EXISTS usage_ledger (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    operation  TEXT NOT NULL,           -- 'chat' | 'deep_research' | 'agent' | 'image' | 'video'
    credits    INTEGER NOT NULL DEFAULT 0,
    model      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Hot path is SUM(credits) WHERE user_id = ? AND created_at >= month-start.
CREATE INDEX IF NOT EXISTS usage_ledger_user_period_idx ON usage_ledger(user_id, created_at DESC);
