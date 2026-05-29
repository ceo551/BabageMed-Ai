"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

// Thin top progress bar that flashes on every route change so a click
// always gives immediate "something is happening" feedback (the App Router
// doesn't expose router start/stop events, so we animate on the pathname/
// query transition). Pair with per-route loading.tsx for the in-flight
// skeleton. Hidden from a11y tree (the page change itself is announced).
function NavProgressInner() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [phase, setPhase] = useState<"idle" | "run" | "done">("idle");
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setPhase("run");
    const t1 = setTimeout(() => setPhase("done"), 320);
    const t2 = setTimeout(() => setPhase("idle"), 720);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [pathname, search]);

  return <div className="nav-progress" data-phase={phase} aria-hidden="true" />;
}

export function NavProgress() {
  // useSearchParams() must sit inside a Suspense boundary or it opts the
  // whole tree out of static prerender.
  return (
    <Suspense fallback={null}>
      <NavProgressInner />
    </Suspense>
  );
}
