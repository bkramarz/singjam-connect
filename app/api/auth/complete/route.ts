import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { syncContact } from "@/lib/activecampaign";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Called after immediate-session signup (email confirmation disabled) to
// create the profile and link any invite token, mirroring the callback route.
export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { inviteToken } = await req.json().catch(() => ({}));
  const admin = supabaseAdmin();

  // Create profile if it doesn't exist yet
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!existing) {
    const emailLocal = (user.email ?? "")
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 15) || "singer";
    let username = "";
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = `${emailLocal}${Math.floor(1000 + Math.random() * 9000)}`;
      const { data: taken } = await admin
        .from("profiles")
        .select("id")
        .eq("username", candidate)
        .maybeSingle();
      if (!taken) { username = candidate; break; }
    }
    if (!username) username = `singer${Date.now()}`;
    await admin.from("profiles").insert({ id: user.id, username });

    if (user.email) syncContact(user.email).catch(() => {});
  }

  // Link invite and resolve jam ID
  let jamId: string | null = null;
  if (inviteToken) {
    await admin.from("jam_invites")
      .update({ invited_user_id: user.id, invitee_email: null })
      .eq("token", inviteToken)
      .is("invited_user_id", null);

    const { data: invite } = await admin
      .from("jam_invites")
      .select("jam_id")
      .eq("token", inviteToken)
      .maybeSingle();
    jamId = invite?.jam_id ?? null;
  }

  return NextResponse.json({ jamId });
}
