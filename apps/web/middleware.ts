import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes reachable WITHOUT a session — the auth flow itself. A signed-in
// visitor who lands here is bounced into the app.
const AUTH = /^\/(login|signup|forgot-password|reset-password|verify-email)(\/|$)/;

// Fully public surfaces: the zero-login trial (/try), shared answer snapshots
// (/s/<id>), and the marketing pages (/product, /pricing, /about). Open to
// EVERYONE — no redirect either way — so a logged-out visitor (and search-engine
// crawlers) reach them without an account. The rest of the app stays gated.
const PUBLIC = /^\/(try|s|product|pricing|about|use-cases|terms|privacy|refund|company)(\/|$)/;

// Gate the whole app behind authentication. A visitor without the session
// cookie is sent to /login (carrying ?next so we can bounce them back after
// sign-in); a signed-in visitor who lands on an auth page is sent into the
// app. Cookie *presence* is the routing signal — real validation still
// happens on every backend call, and the on-401 watchdog in auth-context
// re-bounces if the cookie turns out to be stale, so an expired-but-present
// cookie just costs one extra round-trip rather than being an open door.
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSession = req.cookies.has("pervagans_session");

  // The home page + fully public surfaces are open to everyone — never
  // redirected. An anonymous visitor lands on the dashboard in trial mode
  // (deepseek only, one un-saved conversation); the rest of the app stays
  // gated and the sidebar shows only "Sign in" until they authenticate.
  if (pathname === "/" || PUBLIC.test(pathname)) return NextResponse.next();

  const isAuth = AUTH.test(pathname);

  if (!hasSession && !isAuth) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // Preserve where they were headed so login can bounce them back.
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  if (hasSession && isAuth) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on every page EXCEPT API routes, Next internals, the social-card
  // image routes, and anything with a file extension (static assets,
  // robots.txt, sitemap.xml, manifest.webmanifest — all must stay public so
  // crawlers and the PWA installer can read them without a session).
  matcher: ["/((?!api|_next|opengraph-image|twitter-image|.*\\..*).*)"],
};
