DROP INDEX IF EXISTS user_mfa_backup_codes_user_idx;
DROP TABLE IF EXISTS user_mfa_backup_codes;
DROP TABLE IF EXISTS user_mfa_pending;
ALTER TABLE users DROP COLUMN IF EXISTS totp_enabled_at;
ALTER TABLE users DROP COLUMN IF EXISTS totp_secret_encrypted;
