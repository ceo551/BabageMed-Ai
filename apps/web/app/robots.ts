import type { MetadataRoute } from "next";

// Crawl policy. Public surfaces — the home page and the marketing pages
// (/product, /pricing, /about) — are crawlable; everything behind the login
// gate (the app) or that exposes user/account data is disallowed so Google
// doesn't waste crawl budget on pages that just 307 → /login. Route names match
// the real App Router segments; the (auth) group resolves at the root path.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        // gated app surfaces (redirect to /login for anon — don't crawl)
        "/mcps",
        "/features",
        "/spaces",
        "/gallery",
        "/tasks",
        "/settings",
        "/admin",
        "/billing",
        // auth flow
        "/login",
        "/signup",
        "/forgot-password",
        "/reset-password",
        "/verify-email",
      ],
    },
    sitemap: "https://pervagans.com/sitemap.xml",
    host: "https://pervagans.com",
  };
}
