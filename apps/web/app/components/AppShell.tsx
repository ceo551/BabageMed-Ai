"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { UIProvider, useUI } from "../lib/ui-context";
import { Sidebar } from "./Sidebar";
import { ErrorBoundary } from "./ErrorBoundary";

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
  const { collapsed } = useUI();
  // Pass pathname as the boundary reset key so a successful navigation
  // away from a crashed route clears the fallback automatically.
  const pathname = usePathname() || "";
  return (
    <div className="shell" data-collapsed={collapsed}>
      <Sidebar />
      <main className="main app-main">
        <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>
      </main>
    </div>
  );
}
