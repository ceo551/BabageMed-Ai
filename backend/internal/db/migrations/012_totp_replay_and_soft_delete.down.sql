DROP INDEX IF EXISTS chats_user_active_idx;
ALTER TABLE chats DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE users DROP COLUMN IF EXISTS totp_last_counter;
