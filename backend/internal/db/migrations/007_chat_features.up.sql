-- Per-feature chat history.
--
-- Chats started from the main "/" page have feature_slug = NULL and
-- show up only in the general "History" row in the sidebar. Chats
-- started inside a feature page (e.g. /features/healthcare) carry
-- the slug and show up ONLY in that feature's sub-sidebar — never in
-- the general history. Backend filters via WHERE feature_slug IS NULL
-- vs WHERE feature_slug = $X.

ALTER TABLE chats ADD COLUMN IF NOT EXISTS feature_slug TEXT;

-- Composite index — most list-chat queries fan out on (user_id,
-- feature_slug) pairs (one for general, one per feature page).
CREATE INDEX IF NOT EXISTS chats_user_feature_idx
    ON chats(user_id, feature_slug, updated_at DESC);
