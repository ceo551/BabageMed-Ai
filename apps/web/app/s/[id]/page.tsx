"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useUI } from "../../lib/ui-context";
import { AssistantMessage, type Citation } from "../../components/AssistantMessage";
import { share as shareApi } from "../../lib/api";

// /s/<id> — a public, read-only snapshot of one answer (P4 viral loop). Opens
// with NO account; "Remix in Pervagans" bounces the question into /try, and a
// CTA invites sign-up. Renders chrome-free (AppShell PUBLIC_ROUTE).
export default function SharedAnswerPage() {
  const { id } = useParams<{ id: string }>();
  const { locale } = useUI();
  const ar = locale === "ar";
  const [data, setData] = useState<{ title: string; content: string; citations?: Citation[] } | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    shareApi.get(id)
      .then((d) => { if (!cancelled) setData({ title: d.title, content: d.content, citations: d.citations as Citation[] | undefined }); })
      .catch(() => { if (!cancelled) setNotFound(true); });
    return () => { cancelled = true; };
  }, [id]);

  const remixHref = data?.title ? `/try?q=${encodeURIComponent(data.title)}` : "/try";

  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "clamp(24px,6vw,64px) 20px 64px", gap: 24, background: "var(--bg)" }}>
      <div style={{ width: "100%", maxWidth: 760, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Link href="/try" style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".18em", color: "var(--cyan)", textTransform: "uppercase", textDecoration: "none" }}>Pervagans</Link>
        <Link href="/signup" style={{ fontSize: 13, color: "var(--ink-2)", textDecoration: "none" }}>{ar ? "إنشاء حساب" : "Sign up"}</Link>
      </div>

      {notFound ? (
        <div style={{ width: "100%", maxWidth: 760, textAlign: "center", color: "var(--ink-2)", marginTop: 40 }}>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: 28, color: "var(--ink)" }}>{ar ? "الصفحة غير موجودة" : "Not found"}</h1>
          <p>{ar ? "هذا الرابط منتهي أو غير صحيح." : "This shared link is invalid or expired."}</p>
          <Link href="/try" style={{ color: "var(--cyan)" }}>{ar ? "جرّب Pervagans" : "Try Pervagans"}</Link>
        </div>
      ) : !data ? (
        <div style={{ color: "var(--muted)", marginTop: 40 }}>{ar ? "...تحميل" : "Loading…"}</div>
      ) : (
        <>
          <div style={{ width: "100%", maxWidth: 760, display: "flex", flexDirection: "column", gap: 6, textAlign: ar ? "right" : "left" }}>
            <span style={{ fontSize: 12, color: "var(--muted-2)" }}>{ar ? "إجابة مُشاركة من Pervagans" : "A shared Pervagans answer"}</span>
            {data.title && (
              <h1 dir="auto" style={{ fontFamily: "var(--serif)", fontSize: "clamp(24px,5vw,36px)", lineHeight: 1.15, letterSpacing: "-0.02em", margin: 0, color: "var(--ink)" }}>{data.title}</h1>
            )}
          </div>

          <div style={{ width: "100%", maxWidth: 760 }}>
            <AssistantMessage content={data.content} citations={data.citations} />
          </div>

          <div style={{ width: "100%", maxWidth: 760, marginTop: 12, display: "flex", gap: 14, alignItems: "center", justifyContent: "center", flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 22 }}>
            <Link href={remixHref} style={{ padding: "10px 22px", fontSize: 14, fontWeight: 600, borderRadius: 12, border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--bg)", textDecoration: "none" }}>
              {ar ? "↻ جرّبها في Pervagans" : "↻ Remix in Pervagans"}
            </Link>
            <Link href="/signup" style={{ fontSize: 14, color: "var(--cyan)", textDecoration: "none" }}>
              {ar ? "أنشئ حساب مجاني" : "Create a free account"}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
