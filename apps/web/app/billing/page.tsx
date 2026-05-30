"use client";

import { useEffect, useState } from "react";

type Plan = {
  ID: string;
  Name: string;
  DescriptionEN: string;
  DescriptionAR: string;
  EGP: number;
  USD: number;
  Interval: string;
};

type Providers = { paymob: boolean; paypal: boolean };

// Per-plan feature lists (keyed by plan name, lower-cased). Rendered as a
// checklist on each pricing card. Higher tiers say "Everything in <lower
// tier>" so the cumulative value is obvious.
const PLAN_FEATURES: Record<string, { en: string[]; ar: string[] }> = {
  go: {
    en: ["DeepSeek V4 Pro", "Kimi K2.6", "GLM 5.1", "Qwen 3.7 Max"],
    ar: ["DeepSeek V4 Pro", "Kimi K2.6", "GLM 5.1", "Qwen 3.7 Max"],
  },
  plus: {
    en: ["Up to 2× more usage than GO", "Everything in GO", "Gemini Pro 3.1", "Grok Imagine"],
    ar: ["استخدام أكثر بـ 2× من GO", "كل مزايا GO", "Gemini Pro 3.1", "Grok Imagine"],
  },
  pro: {
    en: ["Everything in Plus", "GPT 5.5", "Claude Opus 4.8", "Veo 3.1", "Happy Horse 1.0", "Qwen Image 2.0", "GPT Image 2"],
    ar: ["كل مزايا Plus", "GPT 5.5", "Claude Opus 4.8", "Veo 3.1", "Happy Horse 1.0", "Qwen Image 2.0", "GPT Image 2"],
  },
  max: {
    en: ["Up to 5× more usage than Pro", "Higher output limits for all tasks", "Everything in Plus", "Every text model", "Every image & video model"],
    ar: ["استخدام أكثر بـ 5 أضعاف من Pro", "حدود إخراج أعلى لكل المهام", "كل مزايا Plus", "كل نماذج النصوص", "كل نماذج الصور والفيديو"],
  },
};

export default function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [providers, setProviders] = useState<Providers>({ paymob: false, paypal: false });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locale, setLocale] = useState<"en" | "ar">("en");

  useEffect(() => {
    Promise.all([
      fetch("/api/backend/api/payments/plans").then((r) => r.ok ? r.json() : Promise.reject(new Error(`plans ${r.status}`))),
      fetch("/api/backend/api/payments/providers").then((r) => r.ok ? r.json() : Promise.reject(new Error(`providers ${r.status}`))),
    ])
      .then(([p, pr]) => {
        setPlans(p?.plans || []);
        setProviders(pr || { paymob: false, paypal: false });
      })
      .catch((e) => setError(e.message));
    setLocale((document.documentElement.lang as "en" | "ar") || "en");
  }, []);

  // Validate redirect URLs against an allow-list of known payment-provider
  // hosts before navigating. If the backend is ever compromised or returns
  // a bad response, this stops the page from sending the user to an
  // attacker-controlled site.
  const PAYMENT_HOSTS = [
    /(^|\.)paymob\.com$/i,
    /(^|\.)accept\.paymob\.com$/i,
    /(^|\.)paypal\.com$/i,
    /(^|\.)sandbox\.paypal\.com$/i,
  ];
  function safeNavigate(url: string) {
    try {
      const u = new URL(url);
      if (!/^https?:$/.test(u.protocol)) throw new Error("non-http URL");
      if (!PAYMENT_HOSTS.some((re) => re.test(u.hostname))) throw new Error("untrusted host: " + u.hostname);
      window.location.href = url;
    } catch (e: any) {
      setError("Refusing to redirect: " + e.message);
    }
  }

  async function payWithPaymob(planID: string) {
    setBusy(planID + ":paymob");
    setError(null);
    try {
      const r = await fetch("/api/backend/api/payments/paymob/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan_id: planID, billing: {} }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Paymob checkout failed");
      safeNavigate(j.iframe_url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function payWithPayPal(planID: string) {
    setBusy(planID + ":paypal");
    setError(null);
    try {
      const r = await fetch("/api/backend/api/payments/paypal/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan_id: planID,
          return_url: window.location.origin + "/billing/return",
          cancel_url: window.location.origin + "/billing/cancel",
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "PayPal checkout failed");
      safeNavigate(j.approve_url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }}>
      <h1 style={{ fontFamily: "var(--serif)", fontSize: 48, margin: 0, color: "var(--ink)" }}>
        {locale === "ar" ? "الخطط والفوترة" : "Plans & Billing"}
      </h1>
      <p style={{ color: "var(--muted)", margin: 0, textAlign: "center", maxWidth: 560 }}>
        {locale === "ar"
          ? "ادفع بـ Paymob (لمصر) أو PayPal (دولي). كل الخطط تتضمن وصولاً كاملاً إلى كل الموصّلات (Connectors)."
          : "Pay with Paymob (Egypt) or PayPal (international). Every plan includes full access to all connectors."}
      </p>

      {error && (
        <div style={{ background: "var(--purple-soft)", border: "1px solid var(--purple-line)", color: "var(--purple)", padding: 12, borderRadius: 10, maxWidth: 600 }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, maxWidth: 1280, width: "100%", alignItems: "stretch" }}>
        {plans.map((p) => (
          <div
            key={p.ID}
            style={{
              background: "var(--panel-solid)",
              border: "1px solid var(--border)",
              borderRadius: 18,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              boxShadow: "var(--shadow)",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 22, color: "var(--ink)" }}>{p.Name}</h2>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".14em", color: "var(--muted)" }}>
                {p.Interval.toUpperCase()}
              </span>
            </div>
            <p style={{ margin: 0, color: "var(--ink-2)", fontSize: 13, lineHeight: 1.5 }}>
              {locale === "ar" ? p.DescriptionAR : p.DescriptionEN}
            </p>
            <div style={{ display: "flex", gap: 16, alignItems: "baseline", color: "var(--ink)" }}>
              <span style={{ fontFamily: "var(--serif)", fontSize: 36 }}>${(p.USD / 100).toFixed(0)}</span>
              <span style={{ color: "var(--muted)" }}>{(p.EGP / 100).toFixed(0)} EGP</span>
            </div>
            <ul style={{ listStyle: "none", margin: "4px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {(PLAN_FEATURES[p.Name.toLowerCase()]?.[locale] || []).map((feat, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, color: "var(--ink-2)", fontSize: 13, lineHeight: 1.45 }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--cyan)" strokeWidth={2.4}
                       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto", paddingTop: 8 }}>
              <button
                type="button"
                disabled={!providers.paymob || busy === p.ID + ":paymob"}
                onClick={() => payWithPaymob(p.ID)}
                style={btnStyle("cyan", !providers.paymob)}
              >
                {busy === p.ID + ":paymob" ? "…" : (locale === "ar" ? "ادفع بـ Paymob" : "Pay with Paymob")}
              </button>
              <button
                type="button"
                disabled={!providers.paypal || busy === p.ID + ":paypal"}
                onClick={() => payWithPayPal(p.ID)}
                style={btnStyle("yellow", !providers.paypal)}
              >
                {busy === p.ID + ":paypal" ? "…" : (locale === "ar" ? "ادفع بـ PayPal" : "Pay with PayPal")}
              </button>
            </div>
            {(!providers.paymob || !providers.paypal) && (
              <p style={{ margin: 0, color: "var(--muted-2)", fontSize: 11 }}>
                {!providers.paymob && "Paymob not configured. "}
                {!providers.paypal && "PayPal not configured."}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function btnStyle(tone: "cyan" | "yellow", disabled: boolean): React.CSSProperties {
  const colorVar = `var(--${tone})`;
  const softVar = `var(--${tone}-soft)`;
  const lineVar = `var(--${tone}-line)`;
  return {
    background: softVar,
    color: colorVar,
    border: `1px solid ${lineVar}`,
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };
}
