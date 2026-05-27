ALTER TABLE users DROP COLUMN IF EXISTS email_verified_at;
DROP TABLE IF EXISTS email_verify_tokens;
DROP TABLE IF EXISTS password_reset_tokens;
