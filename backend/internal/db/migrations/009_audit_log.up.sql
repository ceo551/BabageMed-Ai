-- 009: audit log for sensitive (mostly admin) mutations.
--
-- Captures the actor, target, action, optional details JSON, and
-- timestamp. The set of actions is deliberately open-ended (string
-- column rather than enum) so adding a new auditable op is a one-line
-- code change — the operational tax of enum migrations isn't worth the
-- type-safety win at this scale.
--
-- Common actions wired today:
--   admin.user.promote   actor demoted/promoted target
--   admin.user.demote
--   admin.user.delete
--   admin.user.update
--   admin.payment.update
--   admin.session.revoke
--   auth.password.reset_request
--   auth.password.reset_complete
--   auth.email.verify_complete
--   auth.logout_all
--
-- Reads are admin-only; writes are unauthenticated only for the auth.*
-- bootstrap actions where there's no actor yet (the actor_id column is
-- NULL in that case).

CREATE TABLE IF NOT EXISTS audit_log (
    id           BIGSERIAL PRIMARY KEY,
    actor_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    target_id    UUID,
    action       TEXT NOT NULL,
    details      JSONB,
    ip           TEXT,
    user_agent   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for the two common queries we expect:
--   1. "show recent activity for this user" (admin user-detail page)
--   2. "show every action of type X in the last N days" (security
--      review / incident triage)
CREATE INDEX IF NOT EXISTS audit_log_target_idx ON audit_log(target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log(action, created_at DESC);
