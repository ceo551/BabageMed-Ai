-- 016: Spaces → Projects. Pin a default model per space so opening a space
-- restores the model you work with there (Claude/ChatGPT Projects parity).
-- Nullable; COALESCE'd to '' in the spaces queries, and the frontend falls back
-- to the first text model when empty.
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS default_model TEXT;
