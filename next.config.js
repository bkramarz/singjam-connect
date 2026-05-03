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
        source: "/",
        headers: [
          { key: "Cache-Control", value: "public, max-age=300, s-maxage=600, stale-while-revalidate=86400" },
          { key: "Link", value: "<https://orwkaalmfxzwifnmzvts.supabase.co>; rel=preconnect" },
        ],
      },
      {
        source: "/(repertoire|friends|jams|auth)/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
};
export default nextConfig;
