"use client";

import React, { useEffect, useMemo, useState } from "react";
import { skills as skillsApi, type SkillMeta } from "../lib/api";
import { useUI } from "../lib/ui-context";
import "./skill-picker.css";

// Display names for the catalog categories (backend `category` slugs).
const CATEGORY_LABELS: Record<string, { en: string; ar: string }> = {
  writing:       { en: "Writing & Content",    ar: "الكتابة والمحتوى" },
  research:      { en: "Research & Academic",  ar: "البحث والأكاديمي" },
  translation:   { en: "Translation",          ar: "الترجمة واللغات" },
  data:          { en: "Data & Analytics",     ar: "البيانات والتحليل" },
  business:      { en: "Business & Marketing", ar: "الأعمال والتسويق" },
  finance:       { en: "Finance",              ar: "المالية" },
  design:        { en: "Design & Image",       ar: "التصميم والصور" },
  video:         { en: "Video & Motion",       ar: "الفيديو والموشن" },
  development:   { en: "Development",           ar: "البرمجة والتطوير" },
  communication: { en: "Communication",        ar: "التواصل والإنتاجية" },
};

function catLabel(cat: string, ar: boolean): string {
  const l = CATEGORY_LABELS[cat];
  return l ? (ar ? l.ar : l.en) : cat;
}

// SkillPicker — a catalog browser used inside the feature/space "Skills" modal.
// Controlled: `selected` is the current list of enabled skill ids; `onChange`
// persists the new full list (optimistic — we update the local view first and
// revert if the save throws).
export function SkillPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => Promise<void> | void;
}) {
  const { locale } = useUI();
  const ar = locale === "ar";
  const [all, setAll] = useState<SkillMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [local, setLocal] = useState<Set<string>>(() => new Set(selected));

  useEffect(() => { setLocal(new Set(selected)); }, [selected]);

  useEffect(() => {
    let cancelled = false;
    skillsApi.list()
      .then((list) => { if (!cancelled) setAll(list); })
      .catch(() => { /* leave empty; the row still works */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return all;
    return all.filter(
      (s) =>
        s.name.toLowerCase().includes(t) ||
        s.description.toLowerCase().includes(t) ||
        s.category.includes(t),
    );
  }, [all, q]);

  // Group by category, preserving the catalog's display order.
  const groups = useMemo(() => {
    const m = new Map<string, SkillMeta[]>();
    for (const s of filtered) {
      const arr = m.get(s.category);
      if (arr) arr.push(s);
      else m.set(s.category, [s]);
    }
    return Array.from(m.entries());
  }, [filtered]);

  async function toggle(id: string) {
    const next = new Set(local);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const prev = local;
    setLocal(next); // optimistic
    try {
      await onChange(Array.from(next));
    } catch {
      setLocal(prev); // revert on failure
    }
  }

  return (
    <div className="skp">
      <input
        type="search"
        className="skp-search"
        placeholder={ar ? "ابحث عن مهارة…" : "Search skills…"}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />
      <div className="skp-meta">
        {ar
          ? `${local.size} مفعّلة · ${all.length} متاحة`
          : `${local.size} enabled · ${all.length} available`}
      </div>

      {loading ? (
        <div className="skp-empty">{ar ? "جارٍ التحميل…" : "Loading…"}</div>
      ) : groups.length === 0 ? (
        <div className="skp-empty">{ar ? "لا نتائج" : "No matches"}</div>
      ) : (
        <div className="skp-scroll">
          {groups.map(([cat, items]) => (
            <section key={cat} className="skp-group">
              <h4 className="skp-group-title">{catLabel(cat, ar)}</h4>
              <ul className="skp-list">
                {items.map((s) => {
                  const on = local.has(s.id);
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        className="skp-item"
                        data-on={on}
                        onClick={() => toggle(s.id)}
                        aria-pressed={on}
                      >
                        <span className="skp-check" aria-hidden="true">{on ? "✓" : ""}</span>
                        <span className="skp-body">
                          <span className="skp-name">{s.name}</span>
                          <span className="skp-desc">{s.description}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
