import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseFromBearer } from "@/lib/supabase/bearer";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { syncContact, type ContactProfile } from "@/lib/activecampaign";
import { resend } from "@/lib/resend";
import { enqueueWelcomeEmail } from "@/lib/emailOutbox";

// Called by web and native after every profile save. As well as the
// ActiveCampaign sync it is where the welcome email goes out: signup can't send
// it, because the user hasn't chosen a name yet at that point. The outbox's
// unique (user_id, type) index makes this exactly-once, so later profile edits
// don't re-send.
export async function POST(req: Request) {
  const supabase = await supabaseServer();
  let user = (await supabase.auth.getUser()).data.user ?? null;
  if (!user) {
    // Native app authenticates with a bearer token instead of cookies
    const bearer = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (bearer) user = (await supabaseFromBearer(bearer).auth.getUser()).data.user ?? null;
  }
  if (!user?.email) return NextResponse.json({ ok: false }, { status: 401 });

  const profile: ContactProfile = await req.json().catch(() => ({}));
  syncContact(user.email, profile).catch(() => {});

  const admin = supabaseAdmin();
  const { data: saved } = await admin
    .from("profiles")
    .select("username, display_name")
    .eq("id", user.id)
    .maybeSingle();

  // Only once setup is actually complete — a username is the same signal the
  // auth routes use.
  if (saved?.username) {
    await enqueueWelcomeEmail(admin, resend, {
      userId: user.id,
      email: user.email,
      name: saved.display_name ?? saved.username,
    });
  }

  return NextResponse.json({ ok: true });
}
