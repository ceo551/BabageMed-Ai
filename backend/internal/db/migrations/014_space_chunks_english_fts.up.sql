-- 014: improve Spaces retrieval quality.
--
-- (1) Switch the chunk full-text vector from the 'simple' config (no stemming —
--     "diabetic" never matched "diabetes", and recall on inflected forms was
--     poor) to 'english', so morphological variants match. This rebuilds the
--     STORED generated column for every existing chunk row.
-- (2) Enforce one row per (file_id, idx) so a retried/partial re-chunk can't
--     create duplicate context that double-weights an excerpt in the prompt.
--
-- Idempotent: the column is dropped (cascading its index) then re-added, and
-- the constraint is guarded.

DROP INDEX IF EXISTS space_chunks_tsv_idx;
ALTER TABLE space_chunks DROP COLUMN IF EXISTS tsv;
ALTER TABLE space_chunks ADD COLUMN tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
CREATE INDEX IF NOT EXISTS space_chunks_tsv_idx ON space_chunks USING GIN(tsv);

-- Collapse any pre-existing duplicate chunks (keep one row per (file_id, idx))
-- BEFORE adding the UNIQUE constraint — otherwise ADD CONSTRAINT would error on
-- legacy duplicate data and block startup. ctid is the cheapest stable tie-break.
DELETE FROM space_chunks a
USING space_chunks b
WHERE a.file_id = b.file_id
  AND a.idx = b.idx
  AND a.ctid > b.ctid;

ALTER TABLE space_chunks DROP CONSTRAINT IF EXISTS space_chunks_file_idx_uniq;
ALTER TABLE space_chunks ADD CONSTRAINT space_chunks_file_idx_uniq UNIQUE (file_id, idx);
