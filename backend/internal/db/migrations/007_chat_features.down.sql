DROP INDEX IF EXISTS chats_user_feature_idx;
ALTER TABLE chats DROP COLUMN IF EXISTS feature_slug;
