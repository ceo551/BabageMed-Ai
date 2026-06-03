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
  //
  // The old combined "Image & Video" feature was split into separate /image
  // and /video features. Permanently retire the old URL so it no longer serves
  // a (now generic) page — old bookmarks/links land on the Image page. This is
  // a static rule (no env), so baking it at build time is correct.
  async redirects() {
    return [
      { source: "/features/image-video", destination: "/features/image", permanent: true },
    ];
  },
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
    // connect-src is 'self' (every backend call routes through our same-origin
    // /api/backend/* proxy) PLUS *.paddle.com — the Paddle.js checkout overlay
    // loads its script from cdn.paddle.com, talks to *.paddle.com, and renders
    // its payment form in a child iframe (frame-src), so those origins are
    // allowlisted for the billing page.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.paddle.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.paddle.com",
      "frame-src 'self' https://*.paddle.com",
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
      // Cross-Origin-Resource-Policy: cross-origin pages can't fetch
      // our resources unless they explicitly opt in via CORS. Same-site
      // is wider than same-origin (allows tauri.localhost on the
      // desktop shell which embeds babagemed.com via WebView) but
      // still blocks unrelated third parties from including our pages
      // as <script> / <img> / <link>.
      { key: "Cross-Origin-Resource-Policy", value: "same-site" },
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
