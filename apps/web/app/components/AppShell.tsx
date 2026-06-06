"use client";

import React, { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import { UIProvider, useUI } from "../lib/ui-context";
import { CanvasProvider } from "../lib/canvas-context";
import { usePrefs, prefs } from "../lib/store";
import { Sidebar } from "./Sidebar";
import { CanvasDrawer } from "./CanvasDrawer";
import { ErrorBoundary } from "./ErrorBoundary";
import { I } from "../icons";

// AppShell — single shared chrome wrapper for every "logged-in" page. Owns
// the .shell grid (sidebar | main), mounts the persistent Sidebar, and
// scopes the page content under <main className="main"> so per-page
// shells (.spaces-shell, .mcps-shell, etc) scroll inside the main column
// instead of pushing the sidebar off-screen.
//
// Mounted by app/layout.tsx for every route. The auth pages (login / signup
// / password reset / email verify) render chrome-free — no sidebar, no canvas
// drawer — because the visitor hasn't authenticated yet; showing the app
// navigation there would be misleading and would leak feature names. The
// route-gate in middleware.ts guarantees only signed-in users ever reach the
// chrome'd branch.
const AUTH_ROUTE = /^\/(login|signup|forgot-password|reset-password|verify-email)(\/|$)/;
// Public, chrome-free surfaces (P4): the zero-login trial and shared answer
// pages. Like auth routes they render WITHOUT the sidebar — the visitor may not
// be signed in, and showing app navigation would mislead + leak feature names.
const PUBLIC_ROUTE = /^\/(try|s)(\/|$)/;
// Public marketing pages (/product, /pricing, /about) — crawlable, content-rich
// landing surfaces that render their OWN nav + footer (see app/(marketing)/
// layout.tsx), so the app sidebar is skipped here too.
const MARKETING_ROUTE = /^\/(product|pricing|models|ar|about|use-cases|terms|privacy|refund|company)(\/|$)/;

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <UIProvider>
      <CanvasProvider>
        <Shell>{children}</Shell>
        <ToasterMount />
      </CanvasProvider>
    </UIProvider>
  );
}

// Project-wide toast host (sonner). Mounted once inside the providers so it
// follows the app's theme + reading direction; every notification across the
// app routes through `toast.*` (see lib/toast.ts).
function ToasterMount() {
  const { effectiveTheme, locale } = useUI();
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      dir={locale === "ar" ? "rtl" : "ltr"}
      theme={effectiveTheme === "dark" ? "dark" : "light"}
      toastOptions={{ style: { fontFamily: "var(--sans)" } }}
    />
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  if (AUTH_ROUTE.test(pathname) || PUBLIC_ROUTE.test(pathname) || MARKETING_ROUTE.test(pathname)) {
    // Bare: auth pages center their card; /try and /s render their own
    // full-bleed layout; marketing pages render their own nav + footer. No
    // app sidebar/canvas chrome on any of them.
    return <>{children}</>;
  }
  return (
    <>
      <Frame>{children}</Frame>
      <CanvasDrawer />
    </>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const { collapsed, s } = useUI();
  const { sidebarWidth } = usePrefs();
  // Mobile drawer state — distinct from desktop "collapsed". On a phone the
  // sidebar is off-canvas by default and the hamburger toggles a slide-in
  // overlay; the desktop collapsed toggle stays the 280px↔68px width swap.
  const [mobileOpen, setMobileOpen] = useState(false);
  // Pass pathname as the boundary reset key so a successful navigation
  // away from a crashed route clears the fallback automatically.
  const pathname = usePathname() || "";
  // Close the mobile drawer whenever the route changes, otherwise tapping a
  // sidebar link leaves the overlay sitting on top of the new page.
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  // Esc closes the mobile drawer.
  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setMobileOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <div
      className="shell"
      data-collapsed={collapsed}
      data-mobile-open={mobileOpen}
      style={{ "--sidebar-w": `${sidebarWidth}px` } as React.CSSProperties}
    >
      {/* Mobile-only floating hamburger — visible below the responsive
          breakpoint where the desktop grid hides the sidebar. */}
      <button
        type="button"
        className="mobile-nav-btn"
        aria-label={s.toggleNavigation}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((v) => !v)}
      >
        {I.sidebar}
      </button>
      {/* Sidebar calls useSearchParams() (to read ?c=<chat> and keep the
          active-chat highlight in sync). Next 14 requires any
          useSearchParams() consumer to sit inside a <Suspense> boundary or
          the whole route bails out of static prerender — and because
          AppShell is mounted by the ROOT layout it wraps every page, so an
          unwrapped Sidebar fails `next build` for all 15 routes at once.
          The fallback renders the empty sidebar column (the .shell grid
          already reserves --sidebar-w) so there's no layout shift. */}
      <Suspense fallback={<aside className="sidebar" aria-hidden="true" />}>
        <Sidebar onResize={prefs.setSidebarWidth} onMobileClose={() => setMobileOpen(false)} />
      </Suspense>
      {/* Backdrop tappable area to close the mobile drawer. */}
      <div
        className="mobile-nav-backdrop"
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />
      <main className="main app-main">
        <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>
      </main>
    </div>
  );
}
