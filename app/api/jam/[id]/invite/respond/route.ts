import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jamId } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { response } = await req.json(); // "accepted" | "declined"
  if (!["accepted", "declined"].includes(response)) {
    return NextResponse.json({ error: "Invalid response" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  const { data: invite } = await admin
    .from("jam_invites")
    .select("id, status, invited_by")
    .eq("jam_id", jamId)
    .eq("invited_user_id", user.id)
    .maybeSingle();

  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

  await admin.from("jam_invites").update({ status: response }).eq("id", invite.id);

  if (response === "accepted") {
    // Auto-RSVP — reuse RSVP logic: check capacity
    const { data: jam } = await admin.from("jams").select("capacity, name").eq("id", jamId).single();
    const { count: attendingCount } = await admin
      .from("jam_rsvps")
      .select("id", { count: "exact", head: true })
      .eq("jam_id", jamId)
      .eq("status", "attending");

    const isFull = jam?.capacity != null && (attendingCount ?? 0) >= jam.capacity;
    let waitlistPosition: number | null = null;

    if (isFull) {
      const { count: waitlistCount } = await admin
        .from("jam_rsvps")
        .select("id", { count: "exact", head: true })
        .eq("jam_id", jamId)
        .eq("status", "waitlist");
      waitlistPosition = (waitlistCount ?? 0) + 1;
    }

    const { data: existingRsvp } = await admin
      .from("jam_rsvps")
      .select("id")
      .eq("jam_id", jamId)
      .eq("user_id", user.id)
      .maybeSingle();

    const rsvpStatus = isFull ? "waitlist" : "attending";

    if (existingRsvp) {
      await admin.from("jam_rsvps").update({ status: rsvpStatus, waitlist_position: waitlistPosition }).eq("id", existingRsvp.id);
    } else {
      await admin.from("jam_rsvps").insert({ jam_id: jamId, user_id: user.id, status: rsvpStatus, waitlist_position: waitlistPosition });
    }

    // Notify the person who sent the invite
    if (invite.invited_by) {
      const { data: profile } = await admin.from("profiles").select("display_name, username").eq("id", user.id).single();
      const accepterName = (profile as any)?.display_name ?? (profile as any)?.username ?? "Someone";
      await createNotification({
        userId: invite.invited_by,
        type: "invite_accepted",
        title: `${accepterName} accepted your invite to ${jam?.name ?? "your jam"}`,
        link: `/jam/${jamId}`,
      });
    }
  }

  if (response === "declined" && invite.invited_by) {
    const [{ data: profile }, { data: jam }] = await Promise.all([
      admin.from("profiles").select("display_name, username").eq("id", user.id).single(),
      admin.from("jams").select("name").eq("id", jamId).single(),
    ]);
    const declinerName = (profile as any)?.display_name ?? (profile as any)?.username ?? "Someone";
    await createNotification({
      userId: invite.invited_by,
      type: "invite_declined",
      title: `${declinerName} declined your invite to ${(jam as any)?.name ?? "your jam"}`,
      link: `/jam/${jamId}`,
    });
  }

  return NextResponse.json({ ok: true, rsvpStatus: response === "accepted" ? "attending" : null });
}
