/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  poweredByHeader: false,
  compress: true,
  experimental: {
    typedRoutes: false,
    optimizePackageImports: ["react-markdown", "remark-gfm"],
  },
  // Backend proxy is implemented as an App Router route at
  // app/api/backend/[...path]/route.ts so process.env.BACKEND_URL is read
  // per-request (rewrites here would be baked at build time and miss the
  // Kubernetes-injected env).
  async headers() {
    // Baseline CSP: scripts/styles same-origin (Next.js needs
    // 'unsafe-inline' on styles for the styled-jsx + dynamic theming
    // we use; on scripts it's required for the inline app-router
    // bootstrap until we wire up nonces). img/font-src allowlist is
    // wide for two reasons:
    //   - connector iconUrls come from arbitrary third-party domains
    //     (provider favicons). Locking img-src down would blank every
    //     connector card.
    //   - data: covers SVG inlines + the brand mark.
    // connect-src 'self' is enough because every backend call routes
    // through our same-origin /api/backend/* proxy.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self), clipboard-write=(self), interest-cohort=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "Content-Security-Policy", value: csp },
    ];
    return [
      { source: "/:path*", headers: security },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600" },
          { key: "Content-Type", value: "application/manifest+json" },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};
export default nextConfig;
