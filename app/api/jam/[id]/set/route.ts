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

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: jamId } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: jam } = await supabase.from("jams").select("host_user_id").eq("id", jamId).single();
  if (!jam || jam.host_user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { setId } = await req.json();
  if (!setId) return NextResponse.json({ error: "setId is required" }, { status: 400 });

  const { data: set } = await supabase.from("sets").select("owner_user_id, jam_id").eq("id", setId).single();
  if (!set || set.owner_user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { error } = await supabase.from("sets").update({ jam_id: jamId }).eq("id", setId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: jamId } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: jam } = await supabase.from("jams").select("host_user_id").eq("id", jamId).single();
  if (!jam || jam.host_user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("sets").update({ jam_id: null }).eq("jam_id", jamId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
