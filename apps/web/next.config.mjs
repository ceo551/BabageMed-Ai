/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  experimental: { typedRoutes: false },
  // Backend proxy is implemented as an App Router route at
  // app/api/backend/[...path]/route.ts so process.env.BACKEND_URL is read
  // per-request (rewrites here would be baked at build time and miss the
  // Kubernetes-injected env).
};
export default nextConfig;
