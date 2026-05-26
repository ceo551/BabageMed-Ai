-- Features: 8 fixed feature categories per user, each with custom
-- instructions, selected skills, selected connectors, and uploaded files.
--
-- We do NOT pre-insert rows here — the GET handler upserts on first read so
-- existing users get rows lazily and the migration stays orthogonal to the
-- user table.

CREATE TABLE IF NOT EXISTS features (
  user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug         VARCHAR(40)  NOT NULL,
  instructions TEXT         NOT NULL DEFAULT '',
  skills       JSONB        NOT NULL DEFAULT '[]'::jsonb,
  connectors   JSONB        NOT NULL DEFAULT '[]'::jsonb,
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, slug)
);

CREATE TABLE IF NOT EXISTS feature_files (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug        VARCHAR(40)  NOT NULL,
  name        TEXT         NOT NULL,
  mime        TEXT         NOT NULL DEFAULT '',
  size_bytes  BIGINT       NOT NULL DEFAULT 0,
  md5         TEXT         NOT NULL DEFAULT '',
  content     BYTEA,
  text_body   TEXT         NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feature_files_user_slug_idx
  ON feature_files (user_id, slug);
