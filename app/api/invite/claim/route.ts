import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const admin = supabaseAdmin();
  await admin
    .from("jam_invites")
    .update({ invited_user_id: user.id })
    .eq("token", token)
    .is("invited_user_id", null);

  return NextResponse.json({ ok: true });
}
