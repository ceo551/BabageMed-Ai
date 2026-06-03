"use client";

import React, { useEffect, useState } from "react";
import { useUI } from "../lib/ui-context";
import { useAuth } from "../lib/auth-context";
import { media as mediaApi, type MediaAsset } from "../lib/api";
import "../dashboard.css";
import "../spaces/spaces.css";

// Gallery — the user's durable library of generated images + videos. Every
// generation is self-hosted (see backend/internal/media), so results persist
// here even after the upstream URL would have expired. Each tile links to the
// full asset, shows its prompt, and can be deleted.
export default function GalleryPage() {
  const { s, locale } = useUI();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setItems([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    mediaApi.gallery()
      .then((rows) => { if (!cancelled) setItems(rows); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [authLoading, user]);

  async function remove(id: string) {
    if (typeof window !== "undefined" && !window.confirm(s.galleryDeleteConfirm)) return;
    const prev = items;
    setItems((cur) => cur.filter((a) => a.id !== id)); // optimistic
    try { await mediaApi.remove(id); }
    catch { setItems(prev); }
  }

  if (authLoading) {
    return <div className="sp-loading"><span className="ps-spinner" />{s.loadingChats}</div>;
  }
  if (!user) {
    return (
      <div className="sp-gate">
        <h1>{s.galleryTitle}</h1>
        <p>{locale === "ar"
          ? "سجّل الدخول لعرض مكتبة الوسائط التي أنشأتها."
          : "Sign in to view your generated media library."}</p>
      </div>
    );
  }

  return (
    <div className="gallery-page">
      <div className="spaces-top">
        <h1 className="spaces-header">{s.galleryTitle}</h1>
      </div>

      {loading ? (
        <div className="sp-loading"><span className="ps-spinner" />{s.loadingChats}</div>
      ) : items.length === 0 ? (
        <div className="sp-empty">
          <span className="sp-empty-emoji" aria-hidden="true">🖼️</span>
          <span className="sp-empty-title">{s.galleryEmpty}</span>
        </div>
      ) : (
        <div className="gal-grid">
          {items.map((a) => (
            <div key={a.id} className="gal-card">
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="gal-media" title={a.prompt}>
                {a.kind === "video" ? (
                  <video src={a.url} className="gal-img" muted playsInline preload="metadata" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt={a.prompt} className="gal-img" loading="lazy" />
                )}
                {a.kind === "video" ? <span className="gal-badge" aria-hidden="true">▶</span> : null}
              </a>
              <div className="gal-meta">
                <span className="gal-prompt" title={a.prompt}>{a.prompt || a.model}</span>
                <button
                  type="button"
                  className="gal-del"
                  onClick={() => remove(a.id)}
                  aria-label={s.delete}
                  title={s.delete}
                >×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
