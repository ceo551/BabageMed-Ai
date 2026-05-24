"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { spaces as spacesApi, type Space, type ApiError } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import "./spaces.css";

export default function SpacesPage() {
  const { user, loading } = useAuth();
  const [list, setList] = useState<Space[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  function refresh() {
    spacesApi.list()
      .then(setList)
      .catch((e: ApiError) => setError(e.error || String(e)));
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const sp = await spacesApi.create(name.trim(), desc.trim());
      setName(""); setDesc("");
      setList((cur) => [sp, ...cur]);
    } catch (e: any) {
      setError(e?.error || String(e));
    } finally {
      setCreating(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this space and all its files?")) return;
    try {
      await spacesApi.remove(id);
      setList((cur) => cur.filter((s) => s.id !== id));
    } catch (e: any) {
      setError(e?.error || String(e));
    }
  }

  if (loading) return <div className="spaces-shell"><p className="lead">Loading…</p></div>;
  if (!user) {
    return (
      <div className="spaces-shell">
        <Link href="/" style={{ color: "var(--cyan)", fontSize: 13 }}>← Dashboard</Link>
        <h1>Spaces</h1>
        <p className="lead">Sign in to create spaces and upload files for the assistant to use as context.</p>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/login" className="sb-row" style={{ padding: "10px 14px", border: "1px solid var(--border)", borderRadius: 10, textDecoration: "none", color: "var(--ink)" }}>Sign in</Link>
          <Link href="/signup" className="sb-row" style={{ padding: "10px 14px", border: "1px solid var(--cyan-line)", background: "var(--cyan-soft)", color: "var(--cyan)", borderRadius: 10, textDecoration: "none" }}>Sign up</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="spaces-shell">
      <Link href="/" style={{ color: "var(--cyan)", fontSize: 13 }}>← Dashboard</Link>
      <h1>Spaces</h1>
      <p className="lead">
        Bundle related uploads (PDFs, notes, CSVs, journal extracts) so the assistant grounds its answers in your own corpus.
        Text-based files are chunked and indexed so the chat can pull the most relevant excerpts on every question.
      </p>

      <form className="spaces-toolbar" onSubmit={onCreate}>
        <input type="text" placeholder="Space name (e.g. CKD literature review)" value={name} onChange={(e) => setName(e.target.value)} />
        <input type="text" placeholder="Short description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <button type="submit" disabled={!name.trim() || creating}>{creating ? "Creating…" : "Create space"}</button>
      </form>

      {error && (
        <div style={{ borderRadius: 10, padding: 10, border: "1px solid var(--purple-line)", background: "var(--purple-soft)", color: "var(--purple)" }}>{error}</div>
      )}

      {list.length === 0 ? (
        <div className="empty">No spaces yet — create one above to upload files.</div>
      ) : (
        <div className="spaces-grid">
          {list.map((s) => (
            <div key={s.id} className="space-card" style={{ position: "relative" }}>
              <Link href={`/spaces/${encodeURIComponent(s.id)}`} style={{ color: "inherit", textDecoration: "none" }}>
                <div className="ttl">{s.name}</div>
                <div className="desc">{s.description || "—"}</div>
                <div className="meta">
                  <span>{s.fileCount} file{s.fileCount === 1 ? "" : "s"}</span>
                  <span>{new Date(s.updatedAt).toLocaleDateString()}</span>
                </div>
              </Link>
              <button
                onClick={() => onDelete(s.id)}
                aria-label="Delete space"
                style={{
                  position: "absolute", top: 8, right: 8,
                  background: "transparent", border: "1px solid var(--border)",
                  borderRadius: 8, color: "var(--muted-2)",
                  width: 26, height: 26, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
