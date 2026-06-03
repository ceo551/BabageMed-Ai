-- 015: persist generated media so results don't vanish when the DashScope OSS
-- URL expires, and so a user has a durable Gallery. Bytes live in Postgres
-- BYTEA (same pattern as space_files.raw) — fine for the current volume; a
-- future migration can move blobs to object storage without changing the API
-- (assets are always served via /api/media/{id}).
--
-- The task_id column doubles as the video IDOR fix: an async video job is
-- written here at submit time bound to its owner, so PollVideo can verify
-- (task_id, user_id) instead of letting anyone poll any task.

CREATE TABLE IF NOT EXISTS media_assets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL,                       -- 'image' | 'video'
    model       TEXT NOT NULL,
    prompt      TEXT NOT NULL DEFAULT '',
    params      JSONB NOT NULL DEFAULT '{}'::jsonb,  -- aspect, seed, negativePrompt, …
    task_id     TEXT,                                -- async video task id (NULL for images)
    status      TEXT NOT NULL DEFAULT 'ready',       -- 'pending' | 'ready' | 'failed'
    mime        TEXT NOT NULL DEFAULT '',
    bytes       BYTEA,                               -- NULL until a video task completes
    size_bytes  BIGINT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_assets_user_idx ON media_assets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS media_assets_task_idx ON media_assets(task_id) WHERE task_id IS NOT NULL;
