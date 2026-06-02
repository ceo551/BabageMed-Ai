"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { useUI } from "../lib/ui-context";
import { useAuth } from "../lib/auth-context";
import { spaces as spacesApi, type Space } from "../lib/api";
import { I } from "../icons";
import { CreateSpaceModal } from "./CreateSpaceModal";
import { relativeTime } from "./relative-time";
import "./spaces.css";

// Spaces INDEX — the "Projects" screen (Claude Projects / Perplexity Spaces).
// A header (title + New space), a client-side search filter, and a responsive
// grid of space cards. Empty + auth-gated states mirror the rest of the app.
export default function SpacesIndexPage() {
  const router = useRouter();
  const { s, locale } = useUI();
  const { user, loading: authLoading } = useAuth();

  const [items, setItems] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setItems([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    spacesApi.list()
      .then((list) => { if (!cancelled) setItems(list); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [authLoading, user]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (sp) =>
        sp.name.toLowerCase().includes(q) ||
        (sp.description || "").toLowerCase().includes(q),
    );
  }, [items, query]);

  async function handleCreate(name: string, icon: string) {
    const created = await spacesApi.create({ name, icon });
    router.push(`/spaces/${encodeURIComponent(created.id)}`);
  }

  if (authLoading) {
    return <div className="sp-loading"><span className="ps-spinner" />{s.loadingChats}</div>;
  }
  if (!user) {
    return (
      <div className="sp-gate">
        <h1>{s.spacesHeader}</h1>
        <p>
          {locale === "ar"
            ? "سجّل الدخول لاستخدام المساحات وإدارة تعليماتها وملفاتها ومهاراتها."
            : "Sign in to use spaces and customise their instructions, files and skills."}
        </p>
      </div>
    );
  }

  return (
    <div className="spaces-index">
      <div className="spaces-top">
        <div>
          <h1 className="spaces-header">{s.spacesHeader}</h1>
        </div>
        <button type="button" className="sp-new-btn" onClick={() => setCreating(true)}>
          {I.plus}
          <span>{s.newSpace}</span>
        </button>
      </div>

      <div className="sp-search-wrap">
        <span className="sp-search-ico" aria-hidden="true">{I.globe}</span>
        <input
          type="search"
          className="sp-search"
          placeholder={s.searchSpaces}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={s.searchSpaces}
        />
      </div>

      {loading ? (
        <div className="sp-loading"><span className="ps-spinner" />{s.loadingChats}</div>
      ) : items.length === 0 ? (
        <div className="sp-empty">
          <span className="sp-empty-emoji" aria-hidden="true">{I.spaces}</span>
          <span className="sp-empty-title">{s.noSpacesYet}</span>
          <button type="button" className="sp-new-btn" onClick={() => setCreating(true)}>
            {I.plus}
            <span>{s.newSpace}</span>
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="sp-empty">
          <span className="sp-empty-emoji" aria-hidden="true">🔍</span>
          <span className="sp-empty-title">{s.noSpacesYet}</span>
        </div>
      ) : (
        <div className="sp-grid">
          {filtered.map((sp) => (
            <Link
              key={sp.id}
              href={`/spaces/${encodeURIComponent(sp.id)}`}
              className="sp-card"
            >
              <div className="sp-card-top">
                <span className="sp-card-emoji" aria-hidden="true">{sp.icon || "📁"}</span>
                <span className="sp-card-name" title={sp.name}>{sp.name}</span>
              </div>
              {sp.description ? <p className="sp-card-desc">{sp.description}</p> : null}
              <div className="sp-card-foot">
                {s.updatedAgo} {relativeTime(sp.updatedAt, locale)}
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateSpaceModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
