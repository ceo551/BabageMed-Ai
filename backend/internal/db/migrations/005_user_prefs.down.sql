ALTER TABLE users
    DROP COLUMN IF EXISTS preferred_name,
    DROP COLUMN IF EXISTS profession,
    DROP COLUMN IF EXISTS instructions;
