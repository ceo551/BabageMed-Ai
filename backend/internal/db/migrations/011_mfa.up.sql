-- 011: MFA / TOTP second-factor authentication.
--
-- Three tables:
--   user_mfa_pending     — half-enrolled secrets awaiting confirmation.
--                          One row per user (UNIQUE on user_id) so a
--                          restart of enrollment replaces the previous
--                          state without piling up dead secrets.
--   user_mfa_backup_codes — one row per backup code, bcrypt-hashed.
--                           Consumed on use (DELETE) so a single code
--                           can't be replayed across recoveries.
--   users.totp_*         — the live secret + activation timestamp once
--                          enrollment is confirmed. Encrypted at rest
--                          with AES-GCM (key in MFA_ENCRYPTION_KEY env).
--
-- The encryption-at-rest layer means a leaked DB dump doesn't yield
-- usable TOTP secrets — an attacker would also need the env-side key.

ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret_encrypted TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS user_mfa_pending (
    user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    secret_encrypted  TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at        TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS user_mfa_backup_codes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash   TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    used_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS user_mfa_backup_codes_user_idx ON user_mfa_backup_codes(user_id);
