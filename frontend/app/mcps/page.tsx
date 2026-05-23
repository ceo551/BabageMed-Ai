"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { mcps, type McpServer } from "../lib/api";
import "./mcps.css";

export default function McpsBrowsePage() {
  const [all, setAll] = useState<McpServer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "api" | "scrape" | "hybrid">("all");
  const [category, setCategory] = useState<string>("all");

  useEffect(() => {
    mcps.list().then((r) => setAll(r.servers)).catch((e) => setError(e.error || String(e)));
  }, []);

  const categories = useMemo(() => {
    const set = new Set(all.map((s) => s.category));
    return ["all", ...Array.from(set).sort()];
  }, [all]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((s) => {
      if (kind !== "all" && s.kind !== kind) return false;
      if (category !== "all" && s.category !== category) return false;
      if (!needle) return true;
      return s.id.toLowerCase().includes(needle) || s.name.toLowerCase().includes(needle) || s.base.toLowerCase().includes(needle);
    });
  }, [all, q, kind, category]);

  return (
    <div className="mcps-shell">
      <Link href="/" style={{ color: "var(--cyan)", fontSize: 13 }}>← Dashboard</Link>
      <h1>MCP Servers</h1>
      <p className="lead">Browse all {all.length || "…"} connected MCP servers. Click a card to inspect its tools and run them live.</p>

      <div className="mcps-toolbar">
        <input
          type="search"
          placeholder="Search by id, name, or URL…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={kind} onChange={(e) => setKind(e.target.value as any)}>
          <option value="all">All kinds</option>
          <option value="api">API</option>
          <option value="scrape">Scrape</option>
          <option value="hybrid">Hybrid</option>
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => <option key={c} value={c}>{c === "all" ? "All categories" : c}</option>)}
        </select>
        <span className="mcps-counts">{filtered.length} / {all.length}</span>
      </div>

      {error && <div className="auth-err" style={{ borderRadius: 10, padding: 10, border: "1px solid var(--purple-line)", background: "var(--purple-soft)", color: "var(--purple)" }}>{error}</div>}

      <div className="mcps-grid">
        {filtered.map((s) => (
          <Link key={s.id} href={`/mcps/${encodeURIComponent(s.id)}`} className="mcp-card">
            <div className="row">
              <span className="name">{s.name}</span>
              <span className={`kind ${s.kind}`}>{s.kind}</span>
            </div>
            <div className="meta">{s.base}</div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="id">{s.id}</span>
              <span className="id">:{s.port}</span>
            </div>
            <div className="meta" style={{ color: "var(--muted-2)" }}>{s.category}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
