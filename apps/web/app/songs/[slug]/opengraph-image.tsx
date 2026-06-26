import { ImageResponse } from "next/og";
import { supabaseServer } from "@/lib/supabase/server";

export const alt = "Song on SingJam";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { slug: string } }) {
  const supabase = await supabaseServer();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.slug);
  const query = supabase.from("songs").select("title, display_artist, first_line, year, tonality");
  const { data } = await (
    isUuid
      ? query.eq("id", params.slug)
      : query.or(`slug.eq.${params.slug},former_slug.eq.${params.slug}`)
  ).single();

  const song = data as any;
  const title = song?.title ?? "Song";
  const artist = song?.display_artist ?? null;
  const firstLine = song?.first_line ?? null;
  const year = song?.year ?? null;
  const tonality = song?.tonality ?? null;

  const metaLine = [artist, year ? String(year) : null, tonality].filter(Boolean).join("  ·  ");

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

        {/* Top row: logo + badge */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
          <div
            style={{
              padding: "8px 18px",
              borderRadius: 999,
              border: "1.5px solid #334155",
              fontSize: 14,
              fontWeight: 600,
              color: "#94a3b8",
              letterSpacing: "0.08em",
            }}
          >
            SONG
          </div>
        </div>

        {/* Song info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: title.length > 40 ? 52 : title.length > 25 ? 64 : 78,
              fontWeight: 800,
              color: "#f8fafc",
              lineHeight: 1.05,
              letterSpacing: "-2px",
            }}
          >
            {title}
          </div>
          {metaLine && (
            <div style={{ fontSize: 28, color: "#f59e0b", fontWeight: 500 }}>{metaLine}</div>
          )}
          {firstLine && (
            <div
              style={{
                fontSize: 22,
                color: "#64748b",
                fontStyle: "italic",
                maxWidth: 800,
                display: "flex",
              }}
            >
              "{firstLine.slice(0, 80)}{firstLine.length > 80 ? "…" : ""}"
            </div>
          )}
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
