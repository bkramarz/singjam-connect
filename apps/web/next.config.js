import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "*.supabase.co";

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../..'),
  reactStrictMode: true,
  devIndicators: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" },
      // Google OAuth avatars
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
  },
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
          { key: "Cache-Control", value: "public, max-age=60, s-maxage=60, stale-while-revalidate=3600" },
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
