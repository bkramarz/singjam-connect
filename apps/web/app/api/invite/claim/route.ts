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

  const { data: invite } = await admin
    .from("jam_invites")
    .select("jam_id")
    .eq("token", token)
    .maybeSingle();

  if (invite?.jam_id) {
    const { data: jam } = await admin.from("jams").select("host_user_id").eq("id", invite.jam_id).maybeSingle();
    // A host can't be "invited" to their own jam — opening their own shareable
    // invite link (e.g. to preview it) shouldn't claim it for their account.
    if (jam?.host_user_id !== user.id) {
      await admin
        .from("jam_invites")
        .update({ invited_user_id: user.id })
        .eq("token", token)
        .is("invited_user_id", null);
    }
  }

  return NextResponse.json({ ok: true, jamId: invite?.jam_id ?? null });
}
