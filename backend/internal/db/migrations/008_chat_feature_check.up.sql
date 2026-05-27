-- 008: lock chats.feature_slug to the canonical 10-slug enum.
--
-- Previously a malformed client could insert any string into feature_slug.
-- The Go handler already whitelists on write (chats.go validFeatureSlug),
-- but the database had no defence — a SQL admin script, a direct
-- migration, or a future code path bypassing the handler could create
-- rows that the read-side feature filter then never surfaces.
--
-- CHECK accepts NULL (general chats from the dashboard) plus any of the
-- 10 canonical slugs from backend/internal/features/slugs.go.

ALTER TABLE chats
  ADD CONSTRAINT chats_feature_slug_valid CHECK (
    feature_slug IS NULL OR feature_slug IN (
      'healthcare', 'education', 'writing', 'translation',
      'data-analysis', 'business', 'financial', 'consulting',
      'image-video', 'advertisements'
    )
  );
