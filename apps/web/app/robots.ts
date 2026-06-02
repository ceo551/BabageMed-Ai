import type { MetadataRoute } from "next";

// Crawl policy. The marketing/catalog surface is public (homepage, /mcps,
// /features/*); everything gated behind auth or that exposes user/account
// data is disallowed. Route names match the real App Router segments:
// the (auth) group routes resolve at the root path (/login, /signup, …).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/settings",
        "/admin",
        "/billing",
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
