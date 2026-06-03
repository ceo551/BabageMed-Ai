-- 017: split the single "image-video" feature into separate "image" + "video".
--
-- Migrate any rows still tagged "image-video" to "image" (the closest match;
-- "image" is a brand-new slug so no per-user uniqueness conflict can occur),
-- then widen the chats feature_slug CHECK to the new canonical 8 slugs from
-- backend/internal/features/slugs.go. Idempotent / re-runnable.

-- Drop the OLD constraint FIRST: the prior CHECK (migration 010) only allows
-- 'image-video', so rewriting a chat row to 'image' while it's still in force
-- raises 23514 and CrashLoops the backend on any DB that has image-video chats.
-- (Data-before-constraint, like 009/010 — but those only ever set NULL, which
-- the old constraint always permitted; 017 is the first to assign a new slug.)
ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_feature_slug_valid;

UPDATE chats        SET feature_slug = 'image' WHERE feature_slug = 'image-video';
UPDATE features     SET slug         = 'image' WHERE slug         = 'image-video';
UPDATE feature_files SET slug        = 'image' WHERE slug         = 'image-video';

ALTER TABLE chats
  ADD CONSTRAINT chats_feature_slug_valid CHECK (
    feature_slug IS NULL OR feature_slug IN (
      'education', 'writing', 'translation',
      'data-analysis', 'business', 'financial', 'image', 'video'
    )
  );
