"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { spaces as spacesApi, type Space, type SpaceFile, type ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import "../spaces.css";

export default function SpaceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params?.id || "");
  const { user, loading } = useAuth();
  const [space, setSpace] = useState<Space | null>(null);
  const [files, setFiles] = useState<SpaceFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (loading || !user || !id) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, id]);

  function refresh() {
    Promise.all([spacesApi.get(id), spacesApi.files(id)])
      .then(([sp, fs]) => { setSpace(sp); setFiles(fs); })
      .catch((e: ApiError) => setError(e.error || String(e)));
  }

  async function uploadOne(file: File) {
    setUploading(true);
    setError(null);
    try {
      await spacesApi.upload(id, file);
      refresh();
    } catch (e: any) {
      setError(e?.error || String(e));
    } finally {
      setUploading(false);
    }
  }

  async function uploadMany(fileList: FileList | File[]) {
    for (const f of Array.from(fileList)) {
      await uploadOne(f);
    }
  }

  async function onDelete(fileId: string) {
    if (!confirm("Delete this file?")) return;
    try {
      await spacesApi.removeFile(id, fileId);
      setFiles((cur) => cur.filter((f) => f.id !== fileId));
    } catch (e: any) {
      setError(e?.error || String(e));
    }
  }

  if (loading || (!space && !error)) return <div className="spaces-shell"><p className="lead">Loading…</p></div>;
  if (!user) return <div className="spaces-shell"><p className="lead">Sign in to view this space.</p></div>;
  if (error && !space) return <div className="spaces-shell"><p className="lead">{error}</p></div>;
  if (!space) return null;

  return (
    <div className="spaces-shell space-detail">
      <Link href="/spaces" style={{ color: "var(--cyan)", fontSize: 13 }}>← Spaces</Link>
      <h2>{space.name}</h2>
      {space.description && <p className="desc">{space.description}</p>}

      <div
        className="space-uploader"
        data-drag={dragging}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragging(false);
          if (e.dataTransfer.files?.length) uploadMany(e.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={(e) => { if (e.target.files?.length) uploadMany(e.target.files); }}
        />
        <label onClick={() => inputRef.current?.click()}>
          {uploading ? "Uploading…" : "Choose file"}
        </label>
        <span style={{ color: "var(--muted)", fontSize: 13 }}>
          or drop here · max 10 MB · text-based files get chunked and indexed
        </span>
      </div>

      {error && (
        <div style={{ borderRadius: 10, padding: 10, border: "1px solid var(--purple-line)", background: "var(--purple-soft)", color: "var(--purple)" }}>{error}</div>
      )}

      {files.length === 0 ? (
        <div className="empty">No files yet — upload one above.</div>
      ) : (
        <div className="files-list">
          {files.map((f) => (
            <div key={f.id} className="file-row">
              <span>
                <span className="nm">{f.name}</span>
                <span className="meta"> · {f.mime} · {formatSize(f.sizeBytes)}</span>
              </span>
              {f.hasText ? (
                <span className="pill">{f.chunkCount} chunk{f.chunkCount === 1 ? "" : "s"}</span>
              ) : (
                <span className="pill warn">binary · not indexed</span>
              )}
              <span className="meta">{new Date(f.createdAt).toLocaleDateString()}</span>
              <button onClick={() => onDelete(f.id)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
