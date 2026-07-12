import { ImageResponse } from "next/og";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const alt = "Musician profile on SingJam";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image({ params }: { params: { username: string } }) {
  // Service-role client: user_songs is not anon-readable (see page.tsx).
  const supabase = supabaseAdmin();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, neighborhood, singing_voice, favorite_genres, user_songs(count)")
    .eq("username", params.username)
    .maybeSingle();

  const p = profile as any;
  const name = p?.display_name ?? params.username;
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? "")
    .join("");

  const songCount = p?.user_songs?.[0]?.count ?? 0;

  const voice = p?.singing_voice ?? null;
  const neighborhood = p?.neighborhood ?? null;
  const genres: string[] = p?.favorite_genres ?? [];

  const metaLine = [voice, neighborhood].filter(Boolean).join("  ·  ");

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#0f172a",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 80px",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Glow */}
        <div
          style={{
            position: "absolute",
            top: -80,
            right: -80,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "#f59e0b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
            }}
          >
            🎵
          </div>
          <span style={{ fontSize: 24, fontWeight: 700, color: "#f8fafc" }}>SingJam</span>
        </div>

        {/* Profile content */}
        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          {/* Avatar circle */}
          <div
            style={{
              width: 140,
              height: 140,
              borderRadius: "50%",
              background: "#1e293b",
              border: "3px solid #334155",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 52,
              fontWeight: 700,
              color: "#f59e0b",
              flexShrink: 0,
            }}
          >
            {initials || "?"}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                fontSize: name.length > 30 ? 56 : 72,
                fontWeight: 800,
                color: "#f8fafc",
                lineHeight: 1.05,
                letterSpacing: "-2px",
              }}
            >
              {name}
            </div>
            {metaLine && (
              <div style={{ fontSize: 26, color: "#94a3b8" }}>{metaLine}</div>
            )}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {(songCount ?? 0) > 0 && (
                <div
                  style={{
                    padding: "8px 18px",
                    borderRadius: 999,
                    background: "#1e293b",
                    border: "1.5px solid #334155",
                    fontSize: 18,
                    color: "#cbd5e1",
                  }}
                >
                  {songCount} songs
                </div>
              )}
              {genres.slice(0, 3).map((g: string) => (
                <div
                  key={g}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 999,
                    background: "rgba(245,158,11,0.12)",
                    border: "1.5px solid rgba(245,158,11,0.3)",
                    fontSize: 18,
                    color: "#fbbf24",
                  }}
                >
                  {g}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <span style={{ fontSize: 20, color: "#475569" }}>singjam.org</span>
        </div>
      </div>
    ),
    size,
  );
}
