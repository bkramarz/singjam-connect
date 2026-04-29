import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { syncContact, type ContactProfile } from "@/lib/activecampaign";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ ok: false }, { status: 401 });

  const profile: ContactProfile = await req.json().catch(() => ({}));
  syncContact(user.email, profile).catch(() => {});
  return NextResponse.json({ ok: true });
}
