import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { count } = await supabaseAdmin()
    .from("user_songs")
    .select("song_id", { count: "exact", head: true })
    .eq("song_id", id);
  return NextResponse.json({ count: count ?? 0 });
}
