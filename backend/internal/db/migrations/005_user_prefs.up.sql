-- User-facing settings stored on the users row itself. These are 1:1 with a
-- user so a separate user_preferences table just adds a join for no benefit.
-- All three default to '' so existing rows keep working without backfill.
--
--   preferred_name  — what the assistant addresses the user as
--                     ("What should Claude call you?" in the Settings UI).
--   profession      — short tag the model uses to pick a register
--                     ("Researcher", "Clinician", "Student", "Other").
--   instructions    — persistent system-prompt addendum, capped client-side
--                     to a few thousand chars (no server-side cap today).
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS preferred_name TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS profession     TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS instructions   TEXT NOT NULL DEFAULT '';
