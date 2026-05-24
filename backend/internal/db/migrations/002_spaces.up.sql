-- Spaces — user-scoped "projects" that bundle uploaded files. The chat layer
-- can retrieve relevant chunks from a selected space and inject them as
-- context (Claude Projects / Perplexity Spaces style).

CREATE TABLE IF NOT EXISTS spaces (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS spaces_user_idx ON spaces(user_id, updated_at DESC);

DROP TRIGGER IF EXISTS spaces_touch ON spaces;
CREATE TRIGGER spaces_touch BEFORE UPDATE ON spaces FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE IF NOT EXISTS space_files (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id    UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    mime        TEXT NOT NULL,
    size_bytes  BIGINT NOT NULL,
    md5         TEXT,
    -- Original bytes. Bounded to 10 MB at the handler so the column stays sane.
    raw         BYTEA,
    -- Plain-text extraction (best-effort: text/*, json, csv go in verbatim;
    -- binary formats stay NULL and are not searchable for retrieval).
    raw_text    TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS space_files_space_idx ON space_files(space_id, created_at);

-- Chunks: split raw_text into <= ~500 char paragraphs at upload time,
-- one row per chunk. Generated tsvector + GIN index gives fast full-text
-- retrieval for the /api/spaces/:id/context endpoint.
CREATE TABLE IF NOT EXISTS space_chunks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id     UUID NOT NULL REFERENCES space_files(id) ON DELETE CASCADE,
    space_id    UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    idx         INTEGER NOT NULL,
    content     TEXT NOT NULL,
    tsv         tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS space_chunks_tsv_idx   ON space_chunks USING GIN(tsv);
CREATE INDEX IF NOT EXISTS space_chunks_space_idx ON space_chunks(space_id);
CREATE INDEX IF NOT EXISTS space_chunks_file_idx  ON space_chunks(file_id, idx);
