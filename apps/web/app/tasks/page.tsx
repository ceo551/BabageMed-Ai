"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useUI } from "../lib/ui-context";
import { useAuth } from "../lib/auth-context";
import { AssistantMessage } from "../components/AssistantMessage";
import { agentRuns, type AgentRun } from "../lib/api";
import { enablePush } from "../lib/push";

// /tasks — the async "delegate" hub (P6). Assign a multi-step agent task, close
// the tab, and come back: the run executes in a detached backend goroutine and
// is polled here. Uses the user's connected remote MCPs automatically. Gated
// (renders inside the app chrome).
export default function TasksPage() {
  const { locale } = useUI();
  const { user, loading: authLoading } = useAuth();
  const ar = locale === "ar";
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [task, setTask] = useState("");
  const [starting, setStarting] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    agentRuns.list().then(setRuns).catch(() => {});
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  // Poll while any run is still in flight.
  useEffect(() => {
    if (!runs.some((r) => r.status === "running")) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [runs, load]);

  async function start() {
    const t = task.trim();
    if (!t || starting) return;
    setStarting(true);
    setErr(null);
    // Opt into push on the user's gesture so they're notified when this run
    // finishes even after closing the tab (no-op if denied / unsupported).
    void enablePush();
    try {
      await agentRuns.create(t, [], locale);
      setTask("");
      load();
    } catch (e: any) {
      setErr(e?.status === 402 ? (ar ? "وصلت إلى حد الاستخدام الشهري لباقتك." : "You've reached your plan's monthly usage limit.") : (e?.error || (ar ? "تعذّر بدء المهمة" : "Couldn't start the task")));
    } finally {
      setStarting(false);
    }
  }

  if (authLoading) return <div style={{ padding: 48, color: "var(--muted)" }}>{ar ? "...تحميل" : "Loading…"}</div>;
  if (!user) {
    return (
      <div style={{ padding: 48, maxWidth: 640 }}>
        <h1 style={{ fontFamily: "var(--serif)", color: "var(--ink)" }}>{ar ? "المهام" : "Tasks"}</h1>
        <p style={{ color: "var(--ink-2)" }}>{ar ? "سجّل الدخول لتكليف الوكيل بمهام تعمل في الخلفية." : "Sign in to assign background agent tasks."}</p>
        <Link href="/login" style={{ color: "var(--cyan)" }}>{ar ? "تسجيل الدخول" : "Log in"}</Link>
      </div>
    );
  }

  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ maxWidth: 820, margin: "0 auto", padding: "32px 20px 64px", display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h1 style={{ fontFamily: "var(--serif)", fontSize: "clamp(26px,5vw,38px)", letterSpacing: "-0.02em", margin: 0, color: "var(--ink)" }}>
          {ar ? "المهام في الخلفية" : "Background tasks"}
        </h1>
        <p style={{ margin: 0, color: "var(--ink-2)", fontSize: 14, lineHeight: 1.6 }}>
          {ar
            ? "كلّف الوكيل بمهمة متعددة الخطوات (يستخدم موصِّلاتك المتصلة)، اقفل الصفحة، وارجع تلاقي النتيجة جاهزة."
            : "Assign a multi-step task (it uses your connected connectors), close the page, and come back to a finished result."}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); start(); } }}
          placeholder={ar ? "مثال: ابحث عن 3 موردين، اكتب تقرير مقارنة، واحفظه في Notion…" : "e.g. Research 3 suppliers, write a comparison, and save it to Notion…"}
          rows={3}
          dir="auto"
          style={{ width: "100%", resize: "vertical", padding: "14px 16px", fontSize: 15, lineHeight: 1.6, borderRadius: 14, border: "1px solid var(--border)", background: "var(--panel-solid)", color: "var(--ink)", fontFamily: "inherit" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          {err ? <span role="alert" style={{ color: "var(--error)", fontSize: 13 }}>{err}</span> : <span style={{ fontSize: 12, color: "var(--muted-2)" }}>{ar ? "⌘/Ctrl + Enter" : "⌘/Ctrl + Enter"}</span>}
          <button
            type="button"
            onClick={start}
            disabled={starting || task.trim() === ""}
            style={{ padding: "10px 22px", fontSize: 14, fontWeight: 600, borderRadius: 12, border: "1px solid var(--fuchsia, var(--ink))", background: "var(--fuchsia, var(--ink))", color: "var(--bg)", cursor: starting || !task.trim() ? "not-allowed" : "pointer", opacity: starting || !task.trim() ? 0.55 : 1 }}
          >
            {starting ? "…" : (ar ? "كلّف الوكيل" : "Assign to agent")}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {runs.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 14, padding: "12px 0" }}>{ar ? "لا توجد مهام بعد." : "No tasks yet."}</div>
        ) : runs.map((r) => (
          <div key={r.id} style={{ border: "1px solid var(--border)", borderRadius: 14, background: "var(--panel-solid)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <span dir="auto" style={{ fontWeight: 600, color: "var(--ink)", fontSize: 15, lineHeight: 1.45 }}>{r.task}</span>
              <StatusBadge status={r.status} ar={ar} />
            </div>

            {r.steps && r.steps.length > 0 && (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                {r.steps.map((st, i) => (
                  <li key={i} style={{ fontSize: 12.5, color: "var(--ink-2)", display: "flex", gap: 6, alignItems: "baseline" }}>
                    <span aria-hidden="true">{st.ok === false ? "⚠️" : "🔧"}</span>
                    <span style={{ fontFamily: "var(--mono)", color: "var(--muted)" }}>{st.tool}</span>
                    {st.query ? <span dir="auto" style={{ color: "var(--ink-2)" }}>— {st.query}</span> : null}
                  </li>
                ))}
              </ul>
            )}

            {r.status === "failed" && (
              <div role="alert" style={{ color: "var(--error)", fontSize: 13 }}>{r.error || (ar ? "فشلت المهمة" : "Task failed")}</div>
            )}

            {r.status === "done" && r.result && (
              open === r.id ? (
                <div>
                  <AssistantMessage content={r.result} />
                  <button type="button" onClick={() => setOpen(null)} style={{ marginTop: 6, fontSize: 12, color: "var(--cyan)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    {ar ? "إخفاء" : "Hide"}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setOpen(r.id)} style={{ alignSelf: "flex-start", fontSize: 13, fontWeight: 600, color: "var(--cyan)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  {ar ? "عرض النتيجة ↓" : "View result ↓"}
                </button>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status, ar }: { status: string; ar: boolean }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    running: { label: ar ? "جارٍ التنفيذ" : "Running", color: "var(--cyan)", bg: "var(--cyan-soft)" },
    done: { label: ar ? "تم" : "Done", color: "var(--green, var(--cyan))", bg: "var(--green-soft, var(--cyan-soft))" },
    failed: { label: ar ? "فشلت" : "Failed", color: "var(--error)", bg: "var(--error-soft)" },
  };
  const m = map[status] || map.running;
  return (
    <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, color: m.color, background: m.bg, whiteSpace: "nowrap" }}>
      {status === "running" ? "● " : ""}{m.label}
    </span>
  );
}
