-- 025: track whether a user has explicitly set a feature's skills. Until they
-- do, GET returns the curated per-feature default skills (internal/skills) so
-- the catalog is useful out of the box for new AND existing users; once the
-- user toggles skills in the picker, patch() flips this true and their explicit
-- selection (including an empty one) is respected. Idempotent.
ALTER TABLE features ADD COLUMN IF NOT EXISTS skills_customized BOOLEAN NOT NULL DEFAULT false;
