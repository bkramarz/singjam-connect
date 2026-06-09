import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const { songId } = await req.json();
  await supabase.from("songs").update({ needs_review: false, submitted_by: null }).eq("id", songId);

  return NextResponse.json({ ok: true });
}
