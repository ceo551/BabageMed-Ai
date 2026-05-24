-- spaces.icon  (e.g. "📚", "🎯", "🧠") and spaces.instructions (custom
-- system-prompt prefix injected when this space is the active context).
-- Both default to empty strings so existing rows keep working.
ALTER TABLE spaces
    ADD COLUMN IF NOT EXISTS icon         TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS instructions TEXT NOT NULL DEFAULT '';
