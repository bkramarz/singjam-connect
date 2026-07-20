import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseFromBearer } from "@/lib/supabase/bearer";
import { syncContact, type ContactProfile } from "@/lib/activecampaign";

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
  return NextResponse.json({ ok: true });
}
