"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { mcps, type McpServer, type McpToolSchema } from "../../lib/api";
import "../mcps.css";

type FieldSpec = {
  name: string;
  type: string;
  description?: string;
  enum?: string[];
  items?: any;
  required: boolean;
};

function deriveFields(schema: McpToolSchema): FieldSpec[] {
  const props = schema.inputSchema?.properties || {};
  const required = new Set(schema.inputSchema?.required || []);
  return Object.entries(props).map(([name, def]) => ({
    name,
    type: def.type || (def.enum ? "string" : "string"),
    description: def.description,
    enum: def.enum,
    items: def.items,
    required: required.has(name),
  }));
}

function defaultValue(f: FieldSpec): any {
  switch (f.type) {
    case "number":
    case "integer": return "";
    case "boolean": return false;
    case "array":   return "";
    case "object":  return "{}";
    default:        return "";
  }
}

function coerce(f: FieldSpec, raw: any): any {
  if (raw === "" || raw === undefined || raw === null) return undefined;
  switch (f.type) {
    case "number":
    case "integer": {
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    }
    case "boolean": return Boolean(raw);
    case "array": {
      // accept JSON or comma-separated
      const s = String(raw).trim();
      if (!s) return undefined;
      if (s.startsWith("[")) {
        try { return JSON.parse(s); } catch { return s.split(",").map((x) => x.trim()).filter(Boolean); }
      }
      return s.split(",").map((x) => x.trim()).filter(Boolean);
    }
    case "object": {
      try { return JSON.parse(String(raw)); } catch { return raw; }
    }
    default: return raw;
  }
}

export default function McpDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [server, setServer] = useState<McpServer | null>(null);
  const [tools, setTools] = useState<McpToolSchema[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [input, setInput] = useState<Record<string, any>>({});
  const [result, setResult] = useState<unknown>(null);
  const [runErr, setRunErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([mcps.get(id), mcps.tools(id)])
      .then(([s, t]) => {
        setServer(s);
        setTools(t.tools);
        if (t.tools.length > 0) {
          setActiveTool(t.tools[0].name);
          setInput(initialInput(t.tools[0]));
        }
      })
      .catch((e) => setErr(e.error || String(e)));
  }, [id]);

  function initialInput(t: McpToolSchema): Record<string, any> {
    return Object.fromEntries(deriveFields(t).map((f) => [f.name, defaultValue(f)]));
  }

  function selectTool(name: string) {
    const t = tools?.find((x) => x.name === name);
    if (!t) return;
    setActiveTool(name);
    setInput(initialInput(t));
    setResult(null);
    setRunErr(null);
  }

  async function run() {
    if (!server || !activeTool) return;
    const tool = tools?.find((t) => t.name === activeTool);
    if (!tool) return;
    setBusy(true);
    setResult(null);
    setRunErr(null);
    try {
      const args: Record<string, any> = {};
      for (const f of deriveFields(tool)) {
        const v = coerce(f, input[f.name]);
        if (v !== undefined) args[f.name] = v;
      }
      const r = await mcps.call(server.id, activeTool, args);
      setResult(r.result);
    } catch (e: any) {
      setRunErr(e.error || String(e));
    } finally {
      setBusy(false);
    }
  }

  if (err) {
    return (
      <div className="mcps-shell">
        <Link href="/mcps" style={{ color: "var(--cyan)" }}>← All MCPs</Link>
        <div className="auth-err" style={{ borderRadius: 10, padding: 12, border: "1px solid var(--purple-line)", background: "var(--purple-soft)", color: "var(--purple)" }}>{err}</div>
      </div>
    );
  }
  if (!server || !tools) {
    return <div className="mcps-shell"><p className="lead">Loading…</p></div>;
  }

  const tool = tools.find((t) => t.name === activeTool);

  return (
    <div className="mcps-shell mcp-detail">
      <div className="breadcrumb"><Link href="/mcps">All MCPs</Link> / {server.id}</div>
      <div className="head">
        <h1>{server.name}</h1>
        <span className={`kind ${server.kind}`}>{server.kind}</span>
        <span className="port">port {server.port}</span>
      </div>
      <code className="base">{server.base}</code>
      <p className="lead">{tools.length} tool{tools.length === 1 ? "" : "s"} · category {server.category}</p>

      <div className="tools-list">
        <div className="tools-sidebar">
          {tools.map((t) => (
            <button key={t.name} className="t-row" data-active={t.name === activeTool} onClick={() => selectTool(t.name)} type="button">
              <span className="name">{t.name}</span>
              <span className="desc">{t.description}</span>
            </button>
          ))}
        </div>

        {tool && (
          <div className="tool-panel">
            <h2>{tool.name}</h2>
            {tool.description && <p className="desc">{tool.description}</p>}

            {deriveFields(tool).map((f) => (
              <div key={f.name} className="field">
                <label htmlFor={`f-${f.name}`}>
                  {f.name}
                  {f.required && <span className="req">required</span>}
                  <span className="type">{f.type}{f.enum ? ` enum` : ""}</span>
                </label>
                {f.enum ? (
                  <select id={`f-${f.name}`} value={input[f.name] ?? ""} onChange={(e) => setInput({ ...input, [f.name]: e.target.value })}>
                    <option value="">—</option>
                    {f.enum.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                ) : f.type === "boolean" ? (
                  <select id={`f-${f.name}`} value={String(input[f.name] ?? "")} onChange={(e) => setInput({ ...input, [f.name]: e.target.value === "true" })}>
                    <option value="">—</option>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : f.type === "object" || f.type === "array" ? (
                  <textarea
                    id={`f-${f.name}`}
                    rows={4}
                    value={input[f.name] ?? ""}
                    onChange={(e) => setInput({ ...input, [f.name]: e.target.value })}
                    placeholder={f.type === "array" ? '["item1","item2"] or item1,item2' : '{"key":"value"}'}
                  />
                ) : (
                  <input
                    id={`f-${f.name}`}
                    type={f.type === "number" || f.type === "integer" ? "number" : "text"}
                    value={input[f.name] ?? ""}
                    onChange={(e) => setInput({ ...input, [f.name]: e.target.value })}
                  />
                )}
                {f.description && <span className="hint">{f.description}</span>}
              </div>
            ))}

            <div className="actions">
              <button className="run-btn" onClick={run} disabled={busy}>{busy ? "Running…" : "Run"}</button>
              <span style={{ color: "var(--muted-2)", fontFamily: "var(--mono)", fontSize: 11 }}>
                POST /api/mcp/call/{server.id}/{tool.name}
              </span>
            </div>

            {runErr && <div className="err">{runErr}</div>}
            {result !== null && (
              <pre>{JSON.stringify(result, null, 2)}</pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
