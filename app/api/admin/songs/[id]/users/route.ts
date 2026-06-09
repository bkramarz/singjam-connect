import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const admin = supabaseAdmin();
  const { data } = await admin
    .from("user_songs")
    .select("confidence, profiles(display_name, last_name, username)")
    .eq("song_id", id);

  type ProfileRow = { display_name: string | null; last_name: string | null; username: string };
  type Row = { confidence: string; profiles: ProfileRow | null };
  const rows = (data ?? []) as unknown as Row[];

  const toEntry = (r: Row) => ({
    name: [r.profiles?.display_name, r.profiles?.last_name].filter(Boolean).join(" ") || "Unknown",
    username: r.profiles?.username ?? "",
  });

  return NextResponse.json({
    lead: rows.filter((r) => r.confidence === "lead").map(toEntry),
    support: rows.filter((r) => r.confidence === "support").map(toEntry),
    learn: rows.filter((r) => r.confidence === "learn").map(toEntry),
  });
}
