import { ImageResponse } from "next/og";

export const alt = "SingJam — Sing and Jam with Friends";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
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
          padding: "72px 80px",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Radial glow */}
        <div
          style={{
            position: "absolute",
            top: -100,
            right: -100,
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(245,158,11,0.18) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Logo row */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: "#f59e0b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
            }}
          >
            🎵
          </div>
          <span style={{ fontSize: 28, fontWeight: 700, color: "#f8fafc", letterSpacing: "-0.5px" }}>
            SingJam
          </span>
        </div>

        {/* Main copy */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <span style={{ fontSize: 72, fontWeight: 800, color: "#f8fafc", lineHeight: 1.05, letterSpacing: "-2px" }}>
              Sing and jam
            </span>
            <span style={{ fontSize: 72, fontWeight: 800, color: "#f59e0b", lineHeight: 1.05, letterSpacing: "-2px" }}>
              with friends.
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <span style={{ fontSize: 28, color: "#94a3b8", fontWeight: 400 }}>
              Find your people through shared music. Build your repertoire,
            </span>
            <span style={{ fontSize: 28, color: "#94a3b8", fontWeight: 400 }}>
              discover musicians nearby, and get invited to jams.
            </span>
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
