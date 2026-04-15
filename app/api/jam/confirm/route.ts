import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { resend, FROM_ADDRESS } from "@/lib/resend";
import { jamCreatedHtml } from "@/emails/jam-created";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jamId } = await req.json();
  if (!jamId) return NextResponse.json({ error: "jamId required" }, { status: 400 });

  const admin = supabaseAdmin();

  const [{ data: jam }, { data: profile }, { data: authData }] = await Promise.all([
    admin.from("jams").select("name, starts_at, timezone, host_user_id").eq("id", jamId).single(),
    admin.from("profiles").select("display_name, username").eq("id", user.id).single(),
    admin.auth.admin.getUserById(user.id),
  ]);

  if (!jam || jam.host_user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const email = authData.user?.email;
  if (email) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://singjam.org";
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: email,
      subject: `Your jam is posted — ${jam.name ?? "SingJam"}`,
      html: jamCreatedHtml({
        name: (profile as any)?.display_name ?? (profile as any)?.username,
        jamName: jam.name,
        jamUrl: `${siteUrl}/jam/${jamId}`,
        startsAt: jam.starts_at,
        timezone: (jam as any).timezone,
      }),
    });
  }

  return NextResponse.json({ ok: true });
}
