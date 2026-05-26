"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<"capturing" | "success" | "error">("capturing");
  const [detail, setDetail] = useState<string>("");
  // Guard against double-capture: React StrictMode fires the effect twice
  // in dev, and `params` is also a fresh reference on every render. The
  // server should be idempotent on order_id, but a duplicate POST is
  // wasteful and creates two payment audit rows.
  const captured = useRef(false);

  useEffect(() => {
    if (captured.current) return;
    const orderID = params.get("token") || params.get("orderID");
    if (!orderID) {
      setState("error");
      setDetail("Missing PayPal order id.");
      return;
    }
    captured.current = true;
    fetch("/api/backend/api/payments/paypal/capture", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ order_id: orderID }),
    })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) {
          setState("error");
          setDetail(j.error || "Capture failed");
        } else {
          setState("success");
          setDetail("Order " + (j.id || orderID) + " captured.");
        }
      })
      .catch((e) => {
        setState("error");
        setDetail(e.message);
      });
    // Deliberately only depend on params.get(...) snapshot via the ref guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 480, background: "var(--panel-solid)", border: "1px solid var(--border)", borderRadius: 18, padding: 32, textAlign: "center" }}>
        <h1 style={{ margin: 0, fontFamily: "var(--serif)", fontSize: 36, color: "var(--ink)" }}>
          {state === "capturing" ? "Finalising payment…" : state === "success" ? "Payment successful" : "Payment problem"}
        </h1>
        <p style={{ color: "var(--muted)", marginTop: 16 }}>{detail}</p>
        <button
          onClick={() => router.push("/")}
          style={{ marginTop: 16, background: "var(--cyan-soft)", color: "var(--cyan)", border: "1px solid var(--cyan-line)", borderRadius: 10, padding: "10px 16px", cursor: "pointer", fontWeight: 600 }}
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );
}

export default function ReturnPage() {
  return (
    <Suspense fallback={<div />}>
      <Inner />
    </Suspense>
  );
}
