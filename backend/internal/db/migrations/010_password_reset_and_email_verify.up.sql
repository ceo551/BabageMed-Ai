-- 010: password reset + email verification.
--
-- Both flows share the same "single-use hashed token with expiry"
-- pattern, but the data lives in different shapes:
--
--   - password_reset_tokens is a separate table so a successful reset
--     can purge every outstanding token for that user in one DELETE.
--   - email verification is a column (verified_at) plus a single
--     pending token, also in its own table for the same purge-on-use
--     reason.
--
-- token_hash is bcrypt-hashed at the application layer; the DB stores
-- only the hash so a DB dump doesn't yield directly-usable tokens.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    used_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS password_reset_user_idx ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS password_reset_expires_idx ON password_reset_tokens(expires_at);

CREATE TABLE IF NOT EXISTS email_verify_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    used_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS email_verify_user_idx ON email_verify_tokens(user_id);

-- Has the user proven control of the address? NULL = pending.
-- We don't gate login on this today (sign-in works pre-verification so
-- the UX matches every other product) — the flag is surfaced in
-- Settings + used to mark important emails (billing receipts) as
-- delivered to a verified address.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
