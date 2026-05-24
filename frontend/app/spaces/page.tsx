"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { spaces as spacesApi, type Space, type ApiError } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { NewSpaceModal } from "./NewSpaceModal";
import "./spaces.css";

// Spaces directory.
//
// The "create a space" form used to live inline at the top of the page.
// We replaced it with a single + New space button that pops the
// Perplexity-style NewSpaceModal: emoji picker + title + description +
// custom agent instructions. Cards render the picked emoji on the left
// (or the first letter of the name as a fallback colored chip).
export default function SpacesPage() {
  const { user, loading } = useAuth();
  const [list, setList] = useState<Space[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    spacesApi.list()
      .then(setList)
      .catch((e: ApiError) => setError(e.error || String(e)));
  }, [loading, user]);

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
          <Link href="/login"  className="sb-row" style={{ padding: "10px 14px", border: "1px solid var(--border)", borderRadius: 10, textDecoration: "none", color: "var(--ink)" }}>Sign in</Link>
          <Link href="/signup" className="sb-row" style={{ padding: "10px 14px", border: "1px solid var(--cyan-line)", background: "var(--cyan-soft)", color: "var(--cyan)", borderRadius: 10, textDecoration: "none" }}>Sign up</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="spaces-shell">
      <Link href="/" style={{ color: "var(--cyan)", fontSize: 13 }}>← Dashboard</Link>

      <div className="spaces-header">
        <div>
          <h1>Spaces</h1>
          <p className="lead">
            Bundle related uploads (PDFs, notes, CSVs, journal extracts) so the
            assistant grounds its answers in your own corpus. Text files are
            chunked and indexed so the chat pulls the most relevant excerpts on
            every question.
          </p>
        </div>
        <button
          type="button"
          className="new-space-btn"
          onClick={() => setModalOpen(true)}
        >
          + New space
        </button>
      </div>

      {error && (
        <div style={{ borderRadius: 10, padding: 10, border: "1px solid var(--purple-line)", background: "var(--purple-soft)", color: "var(--purple)" }}>
          {error}
        </div>
      )}

      {list.length === 0 ? (
        <div className="empty">
          <div className="empty-icon" aria-hidden="true">📁</div>
          <div className="empty-title">No spaces yet</div>
          <div className="empty-sub">Create your first space to start grounding the assistant in your own files.</div>
          <button type="button" className="new-space-btn" onClick={() => setModalOpen(true)}>
            + New space
          </button>
        </div>
      ) : (
        <div className="spaces-grid">
          {list.map((s) => (
            <SpaceCard key={s.id} space={s} onDelete={() => onDelete(s.id)} />
          ))}
        </div>
      )}

      <NewSpaceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(sp) => setList((cur) => [sp, ...cur])}
      />
    </div>
  );
}

// SpaceCard — shared rendering for the grid. Picked-emoji on the left,
// falls back to a colored letter chip when icon is empty.
function SpaceCard({ space, onDelete }: { space: Space; onDelete: () => void }) {
  const initial = (space.name.trim()[0] || "?").toUpperCase();
  // Stable colour from the name so each letter-fallback chip stays distinct.
  let h = 0;
  for (let i = 0; i < space.name.length; i++) h = (h * 31 + space.name.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;

  return (
    <div className="space-card">
      <Link href={`/spaces/${encodeURIComponent(space.id)}`} className="card-body">
        <div className="card-row">
          {space.icon ? (
            <span className="space-emoji" aria-hidden="true">{space.icon}</span>
          ) : (
            <span
              className="space-letter"
              aria-hidden="true"
              style={{
                background: `hsl(${hue}, 55%, 35%)`,
                color: `hsl(${hue}, 80%, 92%)`,
              }}
            >
              {initial}
            </span>
          )}
          <div className="card-text">
            <div className="ttl">{space.name}</div>
            <div className="desc">{space.description || "—"}</div>
          </div>
        </div>
        <div className="meta">
          <span>{space.fileCount} file{space.fileCount === 1 ? "" : "s"}</span>
          <span>{new Date(space.updatedAt).toLocaleDateString()}</span>
        </div>
      </Link>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
        aria-label="Delete space"
        className="card-del"
      >
        ×
      </button>
    </div>
  );
}
