type Level = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export function createLogger(name: string) {
  const min = (process.env.LOG_LEVEL || "info").toLowerCase() as Level;
  const minRank = LEVEL_RANK[min] ?? 20;
  function log(level: Level, msg: string, meta?: unknown) {
    if (LEVEL_RANK[level] < minRank) return;
    const line = {
      t: new Date().toISOString(),
      lvl: level,
      svc: name,
      msg,
      ...(meta ? { meta } : {}),
    };
    // stdout reserved for MCP stdio protocol; logs go to stderr
    process.stderr.write(JSON.stringify(line) + "\n");
  }
  return {
    debug: (m: string, meta?: unknown) => log("debug", m, meta),
    info: (m: string, meta?: unknown) => log("info", m, meta),
    warn: (m: string, meta?: unknown) => log("warn", m, meta),
    error: (m: string, meta?: unknown) => log("error", m, meta),
  };
}
