-- 024: Web Push (P6.5) — notify a user when their async agent run finishes,
-- even with the tab closed. app_secrets holds the server VAPID keypair,
-- generated once on first boot and shared across pods (INSERT ON CONFLICT).
-- push_subscriptions holds each browser's Web Push subscription.
CREATE TABLE IF NOT EXISTS app_secrets (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint   TEXT NOT NULL,
    p256dh     TEXT NOT NULL,   -- browser public key (base64url)
    auth       TEXT NOT NULL,   -- browser auth secret (base64url)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, endpoint)
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions(user_id);
