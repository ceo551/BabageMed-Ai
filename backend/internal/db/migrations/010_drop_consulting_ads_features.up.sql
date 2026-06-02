-- 010: remove the retired "consulting" and "advertisements" feature verticals.
--
-- Same shape as 009: null out chats still tagged with either slug (so they
-- fall back to general chats instead of orphaning), drop per-user feature
-- workspaces + their files, then tighten the CHECK constraint to the 7
-- remaining canonical slugs from backend/internal/features/slugs.go.
-- Idempotent: re-runnable.

UPDATE chats SET feature_slug = NULL WHERE feature_slug IN ('consulting', 'advertisements');

DELETE FROM feature_files WHERE slug IN ('consulting', 'advertisements');
DELETE FROM features WHERE slug IN ('consulting', 'advertisements');

ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_feature_slug_valid;

ALTER TABLE chats
  ADD CONSTRAINT chats_feature_slug_valid CHECK (
    feature_slug IS NULL OR feature_slug IN (
      'education', 'writing', 'translation',
      'data-analysis', 'business', 'financial', 'image-video'
    )
  );
