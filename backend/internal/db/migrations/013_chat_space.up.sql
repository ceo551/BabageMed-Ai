-- 013: associate a chat with a Space (per-space threads).
--
-- A chat belongs to at most one space. Space threads are listed on the space
-- page (/spaces/<id>) and are excluded from the general sidebar history.
-- ON DELETE SET NULL: deleting a space turns its threads back into general
-- chats instead of destroying them (the chats package uses soft-delete and
-- we don't want a hard FK cascade bypassing it). Idempotent.

ALTER TABLE chats ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES spaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS chats_space_idx
    ON chats(space_id, updated_at DESC) WHERE space_id IS NOT NULL;
