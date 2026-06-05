"use client";

import Link from "next/link";

export default function CancelPage() {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px max(24px, env(safe-area-inset-right)) calc(24px + env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left))" }}>
      <div style={{ maxWidth: 480, background: "var(--panel-solid)", border: "1px solid var(--border)", borderRadius: 18, padding: 32, textAlign: "center" }}>
        <h1 style={{ margin: 0, fontFamily: "var(--serif)", fontSize: 36, color: "var(--ink)" }}>Payment cancelled</h1>
        <p style={{ color: "var(--muted)", marginTop: 16 }}>No charge was made. You can try again from the billing page.</p>
        <Link href="/billing" style={{ display: "inline-block", marginTop: 16, background: "var(--cyan-soft)", color: "var(--cyan)", border: "1px solid var(--cyan-line)", borderRadius: 10, padding: "10px 16px", fontWeight: 600 }}>
          Back to plans
        </Link>
      </div>
    </div>
  );
}
