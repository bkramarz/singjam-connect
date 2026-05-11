import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const { data } = await supabase
    .from("sets")
    .select("id, name")
    .eq("jam_id", id)
    .maybeSingle();

  return NextResponse.json({ set: data ?? null });
}
