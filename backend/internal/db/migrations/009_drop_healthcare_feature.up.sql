-- 009: remove the retired "healthcare" feature vertical.
--
-- The product no longer ships a "Healthcare & Life sciences" feature
-- (dropped from backend/internal/features/slugs.go and the frontend
-- FEATURES lists). Null out any chats still tagged with it so the
-- read-side filter treats them as general chats instead of orphaning
-- them, drop per-user healthcare feature workspaces + their files, then
-- tighten the CHECK constraint to the 9 remaining canonical slugs.
--
-- Idempotent (matches the convention of every other migration): the
-- UPDATE/DELETEs are no-ops on re-run and the constraint is dropped
-- before being re-added, so a schema_migrations reset can't fatal Migrate.

UPDATE chats SET feature_slug = NULL WHERE feature_slug = 'healthcare';

DELETE FROM feature_files WHERE slug = 'healthcare';
DELETE FROM features WHERE slug = 'healthcare';

ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_feature_slug_valid;

ALTER TABLE chats
  ADD CONSTRAINT chats_feature_slug_valid CHECK (
    feature_slug IS NULL OR feature_slug IN (
      'education', 'writing', 'translation',
      'data-analysis', 'business', 'financial', 'consulting',
      'image-video', 'advertisements'
    )
  );
