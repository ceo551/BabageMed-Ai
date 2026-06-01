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

    // Append the build id as a query param so the browser detects a
    // different sw.js per deploy and re-installs it. Without this,
    // sw.js bytes never change between deploys (it doesn't import
    // anything that does) so the install handler doesn't re-run and
    // the precache stays pinned to the first-ever-deployed VERSION.
    // NEXT_PUBLIC_BUILD_ID is injected by Next.js at build time.
    const buildId = process.env.NEXT_PUBLIC_BUILD_ID || "dev";
    navigator.serviceWorker
      .register(`/sw.js?v=${encodeURIComponent(buildId)}`, { scope: "/" })
      .then((reg) => {
        if (cancelled) return;
        // Auto-update on tab focus instead of waiting for the browser's
        // 24h heuristic — Pervagans ships multiple times a day. The previous
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
