"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useUI } from "../lib/ui-context";
import { AssistantMessage, type Citation } from "../components/AssistantMessage";
import { share as shareApi } from "../lib/api";

// /try — the zero-login trial surface (P4). A no-friction, Arabic-first "wow":
// ask one question, get a streamed, citation-grounded answer (anonymous chat is
// clamped server-side to a cheap model + IP rate-limited), then Share a public
// link or Sign up to keep going. Renders chrome-free (AppShell PUBLIC_ROUTE).
export default function TryPage() {
  const { s, locale } = useUI();
  const ar = locale === "ar";
  const [value, setValue] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [cites, setCites] = useState<Citation[] | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [sharing, setSharing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Prefill from ?q= (the "Remix" bounce-back from a shared page).
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("q");
      if (q) setValue(q.slice(0, 2000));
    } catch { /* ignore */ }
  }, []);

  async function send() {
    const text = value.trim();
    if (!text || sending) return;
    setSending(true);
    setQuestion(text);
    setAnswer("");
    setCites(undefined);
    setShareUrl("");
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    try {
      const r = await fetch("/api/backend/api/chat/stream", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "text/event-stream" },
        credentials: "include",
        body: JSON.stringify({ locale, messages: [{ role: "user", content: text }] }),
        signal: controller.signal,
      });
      if (!r.ok || !r.body) throw new Error(r.status === 402 ? s.quotaReached : `HTTP ${r.status}`);
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let acc = "";
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        buf += dec.decode(chunk, { stream: true }).replace(/\r\n/g, "\n");
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          let ev = "message";
          let data = "";
          for (const line of frame.split("\n")) {
            if (line.startsWith("event:")) ev = line.slice(line[6] === " " ? 7 : 6).trim();
            else if (line.startsWith("data:")) data += (data ? "\n" : "") + line.slice(line[5] === " " ? 6 : 5);
          }
          if (!data) continue;
          let parsed: any = null;
          try { parsed = JSON.parse(data); } catch { /* ignore */ }
          if (ev === "citations" && Array.isArray(parsed)) {
            setCites(parsed as Citation[]);
          } else if (ev === "delta" && typeof parsed?.text === "string") {
            acc += parsed.text;
            setAnswer(acc);
          } else if (ev === "error") {
            acc = (ar ? "خطأ: " : "Error: ") + (parsed?.error || "failed");
            setAnswer(acc);
          }
        }
      }
    } catch (e: any) {
      setAnswer((ar ? "خطأ: " : "Error: ") + (e?.message || "failed"));
    } finally {
      setSending(false);
    }
  }

  async function doShare() {
    if (!answer || sharing) return;
    setSharing(true);
    try {
      const { id } = await shareApi.create({ title: question, content: answer, citations: cites });
      const url = `${window.location.origin}/s/${id}`;
      setShareUrl(url);
      try { await navigator.clipboard.writeText(url); } catch { /* clipboard may be blocked */ }
    } catch { /* ignore — button stays available for retry */ } finally {
      setSharing(false);
    }
  }

  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "clamp(24px,6vw,64px) 20px 64px", gap: 28, background: "var(--bg)" }}>
      <div style={{ width: "100%", maxWidth: 760, display: "flex", flexDirection: "column", gap: 8, textAlign: ar ? "right" : "left" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".18em", color: "var(--cyan)", textTransform: "uppercase" }}>Pervagans</span>
        <h1 style={{ fontFamily: "var(--serif)", fontSize: "clamp(30px,6vw,46px)", lineHeight: 1.12, letterSpacing: "-0.02em", margin: 0, color: "var(--ink)" }}>
          {ar ? "اسأل أي شيء — بالعربي." : "Ask anything — in Arabic or English."}
        </h1>
        <p style={{ margin: 0, color: "var(--ink-2)", fontSize: 15, lineHeight: 1.6 }}>
          {ar
            ? "جرّب مساعد Pervagans الآن بدون تسجيل. إجابات مدعّمة بالمصادر."
            : "Try the Pervagans assistant now — no sign-up. Source-grounded answers."}
        </p>
      </div>

      <div style={{ width: "100%", maxWidth: 760, display: "flex", flexDirection: "column", gap: 10 }}>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }}
          placeholder={ar ? "اكتب سؤالك هنا…" : "Type your question…"}
          rows={3}
          dir="auto"
          style={{ width: "100%", resize: "vertical", padding: "14px 16px", fontSize: 15, lineHeight: 1.6, borderRadius: 14, border: "1px solid var(--border)", background: "var(--panel-solid)", color: "var(--ink)", fontFamily: "inherit" }}
        />
        <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--muted-2)" }}>{ar ? "⌘/Ctrl + Enter للإرسال" : "⌘/Ctrl + Enter to send"}</span>
          <button
            type="button"
            onClick={send}
            disabled={sending || value.trim() === ""}
            style={{ padding: "10px 22px", fontSize: 14, fontWeight: 600, borderRadius: 12, border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--bg)", cursor: sending || !value.trim() ? "not-allowed" : "pointer", opacity: sending || !value.trim() ? 0.55 : 1 }}
          >
            {sending ? (ar ? "..." : "…") : (ar ? "اسأل" : "Ask")}
          </button>
        </div>
      </div>

      {(question || answer) && (
        <div style={{ width: "100%", maxWidth: 760, display: "flex", flexDirection: "column", gap: 14, borderTop: "1px solid var(--border)", paddingTop: 22 }}>
          {question && (
            <div dir="auto" style={{ fontWeight: 600, color: "var(--ink)", fontSize: 16 }}>{question}</div>
          )}
          {answer
            ? <AssistantMessage content={answer} citations={cites} />
            : <div style={{ color: "var(--muted)", fontSize: 14 }}>{ar ? "...جارٍ التفكير" : "Thinking…"}</div>}

          {answer && !sending && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
              <button
                type="button"
                onClick={doShare}
                disabled={sharing}
                style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, borderRadius: 10, border: "1px solid var(--cyan-line)", background: "var(--cyan-soft)", color: "var(--cyan)", cursor: "pointer" }}
              >
                {sharing ? (ar ? "..." : "…") : shareUrl ? (ar ? "✓ تم نسخ الرابط" : "✓ Link copied") : (ar ? "🔗 شارِك" : "🔗 Share")}
              </button>
              {shareUrl && (
                <a href={shareUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--muted)", wordBreak: "break-all" }}>{shareUrl}</a>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ width: "100%", maxWidth: 760, marginTop: "auto", paddingTop: 28, display: "flex", gap: 14, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
        <span style={{ color: "var(--ink-2)", fontSize: 14 }}>
          {ar ? "عايز محادثات محفوظة، موصِّلات، وكيل ذكي، وصور؟" : "Want saved chats, connectors, an agent, and images?"}
        </span>
        <Link href="/signup" style={{ padding: "9px 20px", fontSize: 14, fontWeight: 600, borderRadius: 12, border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--bg)", textDecoration: "none" }}>
          {ar ? "أنشئ حساب مجاني" : "Create a free account"}
        </Link>
        <Link href="/login" style={{ fontSize: 14, color: "var(--cyan)", textDecoration: "none" }}>
          {ar ? "تسجيل الدخول" : "Log in"}
        </Link>
      </div>
    </div>
  );
}
