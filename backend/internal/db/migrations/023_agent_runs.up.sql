-- 023: async agent runs — the "delegate" model (P6). Assign a multi-step agent
-- task, close the tab, come back to a finished deliverable. The run executes in
-- a detached background goroutine that writes its steps + final result here, so
-- it survives the client disconnecting. The foreground SSE /api/agent/stream is
-- unchanged; this is a separate, additive path polled via /api/agent/runs.
CREATE TABLE IF NOT EXISTS agent_runs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task        TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','done','failed')),
    steps       JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{tool,query,ok,preview}]
    result      TEXT,
    error       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS agent_runs_user_idx ON agent_runs(user_id, created_at DESC);
