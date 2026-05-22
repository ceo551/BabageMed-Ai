/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  experimental: { typedRoutes: false },
  async rewrites() {
    return [
      { source: "/api/backend/:path*", destination: (process.env.BACKEND_URL || "http://backend:8080") + "/:path*" },
    ];
  },
};
export default nextConfig;
