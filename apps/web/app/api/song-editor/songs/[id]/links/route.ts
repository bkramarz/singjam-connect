import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireRole("song_editor", "admin");
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const { chord_chart_url, genius_url } = await req.json();

  const { error } = await supabase
    .from("songs")
    .update({ chord_chart_url, genius_url })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
