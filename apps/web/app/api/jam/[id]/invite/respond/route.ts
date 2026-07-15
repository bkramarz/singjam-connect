import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications";

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
    const { data: jam } = await admin.from("jams").select("capacity, name, host_user_id").eq("id", jamId).single();
    if (jam?.host_user_id === user.id) {
      return NextResponse.json({ error: "You can't RSVP to your own jam" }, { status: 400 });
    }
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

    // Add to linked set list if the jam has one and the RSVP is confirmed
    if (rsvpStatus === "attending") {
      const { data: linkedSet } = await admin
        .from("sets")
        .select("id, owner_user_id")
        .eq("jam_id", jamId)
        .maybeSingle();

      if (linkedSet && linkedSet.owner_user_id !== user.id) {
        const { data: existingCollab } = await admin
          .from("set_collaborators")
          .select("id")
          .eq("set_id", linkedSet.id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!existingCollab) {
          await admin.from("set_collaborators").insert({
            set_id: linkedSet.id,
            user_id: user.id,
            invited_by: linkedSet.owner_user_id,
            status: "accepted",
          });
        }
      }
    }

    const { data: profile } = await admin.from("profiles").select("display_name, username").eq("id", user.id).single();
    const accepterName = (profile as any)?.display_name ?? (profile as any)?.username ?? "Someone";

    await Promise.all([
      // Notify the person who sent the invite (if not the host — host gets their own notification below)
      invite.invited_by && invite.invited_by !== (jam as any)?.host_user_id
        ? createNotification({
            userId: invite.invited_by,
            type: "invite_accepted",
            title: `${accepterName} accepted your invite to ${jam?.name ?? "your jam"}`,
            link: `/jam/${jamId}`,
          })
        : Promise.resolve(),
      // Notify the host
      (jam as any)?.host_user_id && (jam as any).host_user_id !== user.id
        ? createNotification({
            userId: (jam as any).host_user_id,
            type: "jam_rsvp",
            title: `${accepterName} is going to ${jam?.name ?? "your jam"}`,
            link: `/jam/${jamId}`,
          })
        : Promise.resolve(),
    ]);
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
