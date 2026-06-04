import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes reachable WITHOUT a session — the auth flow itself.
const PUBLIC = /^\/(login|signup|forgot-password|reset-password|verify-email)(\/|$)/;

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
  const isPublic = PUBLIC.test(pathname);

  if (!hasSession && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // Preserve where they were headed so login can bounce them back.
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  if (hasSession && isPublic) {
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
