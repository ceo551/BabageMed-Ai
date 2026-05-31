"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";

function Inner() {
  const router = useRouter();
  const [locale, setLocale] = useState<"en" | "ar">("en");

  useEffect(() => {
    setLocale((document.documentElement.lang as "en" | "ar") || "en");
  }, []);

  // Paddle redirects here after a successful overlay checkout. The actual
  // plan upgrade happens server-side from the verified `transaction.completed`
  // webhook — this page is just a branded confirmation, so there's nothing to
  // capture or poll here.
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 480, background: "var(--panel-solid)", border: "1px solid var(--border)", borderRadius: 18, padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 8 }}>✅</div>
        <h1 style={{ margin: 0, fontFamily: "var(--serif)", fontSize: 36, color: "var(--ink)" }}>
          {locale === "ar" ? "تم الدفع بنجاح" : "Payment successful"}
        </h1>
        <p style={{ color: "var(--muted)", marginTop: 16 }}>
          {locale === "ar"
            ? "شكرًا لك! يتم تفعيل خطتك خلال لحظات. إذا لم تتحدث فورًا، حدّث الصفحة بعد قليل."
            : "Thank you! Your plan is being activated and will update within moments. If it doesn't update right away, refresh shortly."}
        </p>
        <button
          onClick={() => router.push("/")}
          style={{ marginTop: 16, background: "var(--cyan-soft)", color: "var(--cyan)", border: "1px solid var(--cyan-line)", borderRadius: 10, padding: "10px 16px", cursor: "pointer", fontWeight: 600 }}
        >
          {locale === "ar" ? "العودة إلى لوحة التحكم" : "Back to dashboard"}
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
