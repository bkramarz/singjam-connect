import { ImageResponse } from "next/og";
import { supabaseServer } from "@/lib/supabase/server";

export const alt = "Jam on SingJam";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { id: string } }) {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("jams")
    .select("name, starts_at, neighborhood, visibility, image_url, image_focal_point, profiles(display_name, last_name, username)")
    .eq("id", params.id)
    .single();

  const jam = data as any;
  const name = jam?.name ?? "Upcoming Jam";
  const host = jam?.profiles?.display_name ?? jam?.profiles?.username ?? null;
  const neighborhood = jam?.neighborhood ?? null;
  const imageUrl = jam?.image_url ?? null;
  const focalPoint = jam?.image_focal_point ?? "50% 50%";
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

  const logoMark = (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        background: "#f59e0b",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
      </svg>
    </div>
  );

  const nameFontSize = name.length > 40 ? 54 : name.length > 25 ? 64 : 76;

  if (imageUrl) {
    return new ImageResponse(
      (
        <div
          style={{
            width: 1200,
            height: 630,
            display: "flex",
            position: "relative",
            overflow: "hidden",
            fontFamily: "sans-serif",
          }}
        >
          {/* Photo */}
          <img
            src={imageUrl}
            width={1200}
            height={630}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 1200,
              height: 630,
              objectFit: "cover",
              objectPosition: focalPoint,
            }}
          />

          {/* Top scrim, for logo/badge legibility */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 1200,
              height: 220,
              background: "linear-gradient(to bottom, rgba(15,23,42,0.8) 0%, rgba(15,23,42,0) 100%)",
              display: "flex",
            }}
          />

          {/* Bottom scrim, for name/date legibility */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              width: 1200,
              height: 340,
              background: "linear-gradient(to top, rgba(15,23,42,0.95) 0%, rgba(15,23,42,0) 100%)",
              display: "flex",
            }}
          />

          {/* Content */}
          <div
            style={{
              position: "relative",
              width: 1200,
              height: 630,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "64px 80px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {logoMark}
                <span style={{ fontSize: 24, fontWeight: 700, color: "#f8fafc" }}>SingJam</span>
              </div>
              <div
                style={{
                  padding: "8px 18px",
                  borderRadius: 999,
                  border: "1.5px solid rgba(255,255,255,0.4)",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#f8fafc",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {visibilityLabel}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  fontSize: nameFontSize,
                  fontWeight: 800,
                  color: "#f8fafc",
                  lineHeight: 1.05,
                  letterSpacing: "-2px",
                }}
              >
                {name}
              </div>
              {metaLine && (
                <div style={{ fontSize: 26, color: "#e2e8f0", fontWeight: 400 }}>
                  {metaLine}
                </div>
              )}
            </div>
          </div>
        </div>
      ),
      size,
    );
  }

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
            {logoMark}
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
              fontSize: nameFontSize,
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
