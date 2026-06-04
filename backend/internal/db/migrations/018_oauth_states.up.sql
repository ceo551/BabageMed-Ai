-- Short-lived OAuth authorization-code flow state. A row is created when a user
-- starts connecting a connector (binds the random state → user + connector +
-- optional PKCE verifier) and consumed once on the provider callback. Stale
-- rows are swept opportunistically on start (older than 15 min).
CREATE TABLE IF NOT EXISTS oauth_states (
    state         TEXT PRIMARY KEY,
    user_id       UUID NOT NULL,
    mcp_id        TEXT NOT NULL,
    code_verifier TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS oauth_states_created_idx ON oauth_states (created_at);
