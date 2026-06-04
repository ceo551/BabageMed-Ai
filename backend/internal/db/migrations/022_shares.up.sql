-- 022: public answer snapshots — the zero-login trial's viral loop (P4).
-- "Share" stores one assistant answer (title + markdown + its citations); /s/{id}
-- renders it with NO account, and a "Remix in Pervagans" CTA bounces into /try.
-- Anonymous users may create shares (user_id nullable → SET NULL if the owner is
-- later deleted). Abuse is bounded by an IP rate limiter + size caps in the handler.
CREATE TABLE IF NOT EXISTS shares (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    title      TEXT,
    content    TEXT NOT NULL,
    citations  JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
