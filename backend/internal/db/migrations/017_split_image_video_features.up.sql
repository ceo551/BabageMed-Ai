-- 017: split the single "image-video" feature into separate "image" + "video".
--
-- Migrate any rows still tagged "image-video" to "image" (the closest match;
-- "image" is a brand-new slug so no per-user uniqueness conflict can occur),
-- then widen the chats feature_slug CHECK to the new canonical 8 slugs from
-- backend/internal/features/slugs.go. Idempotent / re-runnable.

UPDATE chats        SET feature_slug = 'image' WHERE feature_slug = 'image-video';
UPDATE features     SET slug         = 'image' WHERE slug         = 'image-video';
UPDATE feature_files SET slug        = 'image' WHERE slug         = 'image-video';

ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_feature_slug_valid;

ALTER TABLE chats
  ADD CONSTRAINT chats_feature_slug_valid CHECK (
    feature_slug IS NULL OR feature_slug IN (
      'education', 'writing', 'translation',
      'data-analysis', 'business', 'financial', 'image', 'video'
    )
  );
