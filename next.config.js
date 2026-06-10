/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // The home page renders identical anonymous HTML for everyone (auth is
        // resolved client-side), so it is safe to share-cache. This relies on
        // Netlify's CDN not storing responses that carry a Set-Cookie header —
        // middleware may emit one when refreshing a logged-in user's session.
        source: "/",
        headers: [
          { key: "Cache-Control", value: "public, max-age=300, s-maxage=600, stale-while-revalidate=3600" },
        ],
      },
      {
        source: "/(repertoire|friends|jams|auth|profile|account|notifications|matches|admin|search)(.*)",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
};
export default nextConfig;
