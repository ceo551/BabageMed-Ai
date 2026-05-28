"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { UIProvider, useUI } from "../lib/ui-context";
import { usePrefs, prefs } from "../lib/store";
import { Sidebar } from "./Sidebar";
import { ErrorBoundary } from "./ErrorBoundary";
import { I } from "../icons";

// AppShell — single shared chrome wrapper for every "logged-in" page. Owns
// the .shell grid (sidebar | main), mounts the persistent Sidebar, and
// scopes the page content under <main className="main"> so per-page
// shells (.spaces-shell, .mcps-shell, etc) scroll inside the main column
// instead of pushing the sidebar off-screen.
//
// Mounted by app/layout.tsx for the default route group; the (auth) route
// group has its own layout that bypasses AppShell so login/signup stay
// chrome-free.
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <UIProvider>
      <Frame>{children}</Frame>
    </UIProvider>
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
      <Sidebar onResize={prefs.setSidebarWidth} onMobileClose={() => setMobileOpen(false)} />
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
