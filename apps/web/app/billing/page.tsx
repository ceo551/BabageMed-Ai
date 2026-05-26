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

export default function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [providers, setProviders] = useState<Providers>({ paymob: false, paypal: false });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locale, setLocale] = useState<"en" | "ar">("en");

  useEffect(() => {
    Promise.all([
      fetch("/api/backend/api/payments/plans").then((r) => r.json()),
      fetch("/api/backend/api/payments/providers").then((r) => r.json()),
    ]).then(([p, pr]) => {
      setPlans(p?.plans || []);
      setProviders(pr || { paymob: false, paypal: false });
    });
    setLocale((document.documentElement.lang as "en" | "ar") || "en");
  }, []);

  async function payWithPaymob(planID: string) {
    setBusy(planID + ":paymob");
    setError(null);
    try {
      const r = await fetch("/api/backend/api/payments/paymob/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan_id: planID, billing: {} }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Paymob checkout failed");
      window.location.href = j.iframe_url;
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
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan_id: planID,
          return_url: window.location.origin + "/billing/return",
          cancel_url: window.location.origin + "/billing/cancel",
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "PayPal checkout failed");
      window.location.href = j.approve_url;
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
          ? "ادفع بـ Paymob (لمصر) أو PayPal (دولي). كل الخطط تتضمن وصولاً كاملاً إلى 86 خادم MCP."
          : "Pay with Paymob (Egypt) or PayPal (international). Every plan includes full access to all 86 MCP servers."}
      </p>

      {error && (
        <div style={{ background: "var(--purple-soft)", border: "1px solid var(--purple-line)", color: "var(--purple)", padding: 12, borderRadius: 10, maxWidth: 600 }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, maxWidth: 1000, width: "100%" }}>
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
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
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
