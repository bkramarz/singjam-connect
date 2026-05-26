import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
