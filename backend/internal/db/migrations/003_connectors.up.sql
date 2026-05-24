-- user_connectors — tracks which MCP servers each user has explicitly
-- "connected". One row per (user, mcp). This is what powers the Claude-style
-- "add connector with one click" UX: the row's existence means the user has
-- opted in to surface this MCP in their composer popover and let the chat
-- layer use it for retrieval.
--
-- `config` is JSONB so api-kind MCPs that need user-supplied credentials
-- (api keys, OAuth tokens) can stash them here without a schema change per
-- connector. Today most rows will just be `{}`.

CREATE TABLE IF NOT EXISTS user_connectors (
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mcp_id       TEXT NOT NULL,
    kind         TEXT NOT NULL,            -- snapshot of mcp.kind at connect time (api / scrape / hybrid)
    config       JSONB NOT NULL DEFAULT '{}'::jsonb,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, mcp_id)
);
CREATE INDEX IF NOT EXISTS user_connectors_user_idx ON user_connectors(user_id, connected_at DESC);
