-- 020: per-space persistent memory — durable facts/preferences the assistant
-- should carry across EVERY chat in a space (ChatGPT-memory / Projects parity).
-- Distinct from space_files (uploaded docs, retrieved on demand) and skills
-- (capability labels): these are short, user-curated statements injected into
-- the system prompt on every turn in the space. Ownership is via the parent
-- space (JOIN spaces ... WHERE user_id), same as space_files — no redundant
-- user_id column. Cascade-deletes with the space.
CREATE TABLE IF NOT EXISTS space_memory (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id   UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    -- kind lets a future auto-inference pass and connector-state sync coexist
    -- with hand-saved facts; the chat layer treats them uniformly for now.
    kind       TEXT NOT NULL DEFAULT 'fact' CHECK (kind IN ('fact','preference','connector_state')),
    content    TEXT NOT NULL,
    -- provenance: 'user' (hand-saved), 'inferred' (future auto-extraction),
    -- or 'connector:<id>'. Surfaced in the UI so inferred items are editable.
    source     TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS space_memory_space_idx ON space_memory(space_id, created_at DESC);

DROP TRIGGER IF EXISTS space_memory_touch ON space_memory;
CREATE TRIGGER space_memory_touch BEFORE UPDATE ON space_memory FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
