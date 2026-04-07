import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications";
import { resend, FROM_ADDRESS } from "@/lib/resend";
import { jamCancelledHtml } from "@/emails/jam-cancelled";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();

  const { data: jam } = await admin
    .from("jams")
    .select("host_user_id, name, starts_at")
    .eq("id", id)
    .maybeSingle();

  if (!jam) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (jam.host_user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Fetch all attendees and waitlisted users before deleting
  const { data: rsvps } = await admin
    .from("jam_rsvps")
    .select("user_id")
    .eq("jam_id", id)
    .in("status", ["attending", "waitlist"]);

  const attendeeIds = (rsvps ?? []).map((r: any) => r.user_id).filter((uid: string) => uid !== user.id);

  await supabase.from("jams").delete().eq("id", id);

  // Notify attendees + host in parallel — fire and forget errors
  const allNotifyIds = [...attendeeIds, user.id];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, display_name, username")
    .in("id", allNotifyIds);

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  await Promise.allSettled(allNotifyIds.map(async (uid: string) => {
    const isHost = uid === user.id;
    const profile = profileMap.get(uid);
    const { data: authData } = await admin.auth.admin.getUserById(uid);
    const email = authData.user?.email;
    const name = profile?.display_name ?? profile?.username ?? null;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://singjam.org";

    await Promise.allSettled([
      isHost ? Promise.resolve() : createNotification({
        userId: uid,
        type: "jam_cancelled",
        title: `${jam.name ?? "A jam you were attending"} has been cancelled`,
      }),
      email ? resend.emails.send({
        from: FROM_ADDRESS,
        to: email,
        subject: `${jam.name ?? "A jam"} has been cancelled`,
        html: jamCancelledHtml({ name, jamName: jam.name, startsAt: jam.starts_at, isHost }),
      }) : Promise.resolve(),
    ]);
  }));

  return NextResponse.json({ ok: true });
}
