-- Remote MCP connectors — external MCP servers (e.g. https://mcp.notion.com/mcp)
-- a user connects via the MCP authorization flow (OAuth 2.0 + dynamic client
-- registration + PKCE), exactly like Claude/Perplexity/Manus. No operator app
-- registration: we register a client dynamically per server. Secret/token
-- columns hold AES-GCM ciphertext (secretbox); "" when absent (public client).
CREATE TABLE IF NOT EXISTS remote_connectors (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL,
    name          TEXT NOT NULL,
    server_url    TEXT NOT NULL,                  -- the MCP endpoint to call
    authorize_url TEXT NOT NULL DEFAULT '',
    token_url     TEXT NOT NULL DEFAULT '',
    client_id     TEXT NOT NULL DEFAULT '',
    client_secret TEXT NOT NULL DEFAULT '',       -- enc; "" for public clients
    access_token  TEXT NOT NULL DEFAULT '',       -- enc
    refresh_token TEXT NOT NULL DEFAULT '',       -- enc
    expires_at    BIGINT NOT NULL DEFAULT 0,
    scope         TEXT NOT NULL DEFAULT '',
    connected     BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, server_url)
);
CREATE INDEX IF NOT EXISTS remote_connectors_user_idx ON remote_connectors (user_id);
