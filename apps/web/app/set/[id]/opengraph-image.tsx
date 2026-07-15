import { ImageResponse } from "next/og";
import { supabaseServer } from "@/lib/supabase/server";

export const alt = "Song set on SingJam";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { id: string } }) {
  const supabase = await supabaseServer();
  const [setRes, countRes] = await Promise.all([
    supabase
      .from("sets")
      .select("name, description, profiles(display_name, username)")
      .eq("id", params.id)
      .single(),
    supabase.from("set_songs").select("id", { count: "exact", head: true }).eq("set_id", params.id),
  ]);

  const set = setRes.data as any;
  const name = set?.name ?? "Song Set";
  const owner = set?.profiles?.display_name ?? set?.profiles?.username ?? null;
  const description = set?.description ?? null;
  const songCount = countRes.count ?? 0;

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
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
              </svg>
            </div>
            <span style={{ fontSize: 24, fontWeight: 700, color: "#f8fafc" }}>SingJam</span>
          </div>
          <div
            style={{
              display: "flex",
              padding: "8px 18px",
              borderRadius: 999,
              border: "1.5px solid #334155",
              fontSize: 14,
              fontWeight: 600,
              color: "#94a3b8",
              letterSpacing: "0.08em",
            }}
          >
            SET LIST
          </div>
        </div>

        {/* Set info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              fontSize: name.length > 40 ? 52 : name.length > 25 ? 64 : 76,
              fontWeight: 800,
              color: "#f8fafc",
              lineHeight: 1.05,
              letterSpacing: "-2px",
            }}
          >
            {name}
          </div>
          {description && (
            <div
              style={{
                fontSize: 26,
                color: "#94a3b8",
                maxWidth: 900,
                overflow: "hidden",
                display: "flex",
              }}
            >
              {description}
            </div>
          )}
          <div style={{ display: "flex", gap: 16 }}>
            {songCount > 0 && (
              <div
                style={{
                  display: "flex",
                  padding: "8px 18px",
                  borderRadius: 999,
                  background: "#1e293b",
                  border: "1.5px solid #334155",
                  fontSize: 20,
                  color: "#cbd5e1",
                }}
              >
                {songCount} song{songCount === 1 ? "" : "s"}
              </div>
            )}
            {owner && (
              <div
                style={{
                  display: "flex",
                  padding: "8px 18px",
                  borderRadius: 999,
                  background: "rgba(245,158,11,0.12)",
                  border: "1.5px solid rgba(245,158,11,0.3)",
                  fontSize: 20,
                  color: "#fbbf24",
                }}
              >
                by {owner}
              </div>
            )}
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
