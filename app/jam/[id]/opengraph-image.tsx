import { ImageResponse } from "next/og";
import { supabaseServer } from "@/lib/supabase/server";

export const alt = "Jam on SingJam";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { id: string } }) {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("jams")
    .select("name, starts_at, neighborhood, visibility, profiles(display_name, last_name, username)")
    .eq("id", params.id)
    .single();

  const jam = data as any;
  const name = jam?.name ?? "Upcoming Jam";
  const host = jam?.profiles?.display_name ?? jam?.profiles?.username ?? null;
  const neighborhood = jam?.neighborhood ?? null;
  const visibility = jam?.visibility ?? "community";
  const visibilityLabel =
    visibility === "official" ? "OFFICIAL JAM" : visibility === "community" ? "COMMUNITY JAM" : "PRIVATE JAM";

  let dateStr: string | null = null;
  let timeStr: string | null = null;
  if (jam?.starts_at) {
    const d = new Date(jam.starts_at);
    dateStr = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  const metaLine = [dateStr, timeStr, neighborhood, host ? `Hosted by ${host}` : null]
    .filter(Boolean)
    .join("  ·  ");

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
              textTransform: "uppercase",
            }}
          >
            {visibilityLabel}
          </div>
        </div>

        {/* Jam name */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: name.length > 40 ? 54 : name.length > 25 ? 64 : 76,
              fontWeight: 800,
              color: "#f8fafc",
              lineHeight: 1.05,
              letterSpacing: "-2px",
            }}
          >
            {name}
          </div>
          {metaLine && (
            <div style={{ fontSize: 26, color: "#94a3b8", fontWeight: 400 }}>
              {metaLine}
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
