-- 011: per-space skills — a JSON array of skill ids/filenames attached to a
-- space (parity with the features.skills column). The space page lets users
-- add/remove them. Idempotent.
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS skills JSONB NOT NULL DEFAULT '[]'::jsonb;
