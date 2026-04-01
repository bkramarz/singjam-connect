import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify the requester is the host
  const { data: jam } = await supabase
    .from("jams")
    .select("host_user_id")
    .eq("id", id)
    .maybeSingle();

  if (!jam) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (jam.host_user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await supabase.from("jams").delete().eq("id", id);

  return NextResponse.json({ ok: true });
}
