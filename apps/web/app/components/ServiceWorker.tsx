"use client";
// Service-worker bootstrapper. Mounted once at the root layout. Only
// registers on production builds because Next.js's dev mode invalidates
// the bundle on every save and a stale SW caches the broken intermediate.

import { useEffect } from "react";

export function ServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        if (cancelled) return;
        // Auto-update on tab focus instead of waiting for the browser's
        // 24h heuristic — Babbage ships multiple times a day. The previous
        // implementation returned the cleanup from inside .then() — but
        // Promise.then's return value is the next promise, not a hook
        // cleanup, so the listener leaked across hot reloads and unmounts.
        const refresh = () => { reg.update().catch(() => {}); };
        window.addEventListener("focus", refresh);
        cleanup = () => window.removeEventListener("focus", refresh);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);
  return null;
}
