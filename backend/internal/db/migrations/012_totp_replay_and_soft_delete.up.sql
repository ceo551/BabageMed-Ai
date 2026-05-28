-- 012_totp_replay_and_soft_delete.up.sql
--
-- Two related security/UX fixes from the 40-agent audit pass:
--
-- 1. TOTP replay protection. The mfa package's doc comment promised
--    "a successful code is recorded so the same code can't be used twice
--    inside its 30-second window" but never persisted anything. Add a
--    last-used counter column so Validate() can reject re-use.
--
-- 2. Soft-delete for chats so admin user-delete + per-user chat delete
--    can be undone, audited, and don't lose the message history outright.
--    Hard DELETE is still possible via admin tooling.

-- TOTP replay window — store the last accepted time-step counter so a
-- second match within ±1 step (which Verify accepts) is rejected.
-- Lives on `users` next to totp_secret_encrypted (see 011_mfa).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS totp_last_counter BIGINT NOT NULL DEFAULT 0;

-- Soft-delete column on chats. NULL = active, non-NULL = deleted-at
-- timestamp. Reads should filter on `WHERE deleted_at IS NULL` unless
-- explicitly recovering. Index for the common "list my active chats"
-- query.
ALTER TABLE chats
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS chats_user_active_idx
  ON chats (user_id, updated_at DESC)
  WHERE deleted_at IS NULL;
