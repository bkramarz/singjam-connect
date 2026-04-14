import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { resend, FROM_ADDRESS } from "@/lib/resend";
import { createNotification } from "@/lib/notifications";
import { memberInviteHtml, nonMemberInviteHtml } from "@/emails/jam-invite";

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

  const { inviteeUserId, inviteeEmail } = await req.json();
  if (!inviteeUserId && !inviteeEmail) {
    return NextResponse.json({ error: "Provide inviteeUserId or inviteeEmail" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // Load jam
  const { data: jam } = await admin
    .from("jams")
    .select("id, name, starts_at, visibility, host_user_id, guests_can_invite")
    .eq("id", jamId)
    .single();
  if (!jam) return NextResponse.json({ error: "Jam not found" }, { status: 404 });
  if (jam.visibility === "official") return NextResponse.json({ error: "Official events don't use invites" }, { status: 400 });

  // Permission check
  const isHost = jam.host_user_id === user.id;
  if (!isHost) {
    if (jam.visibility === "community") {
      // Must be attending
      const { data: rsvp } = await admin
        .from("jam_rsvps")
        .select("status")
        .eq("jam_id", jamId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (rsvp?.status !== "attending") {
        return NextResponse.json({ error: "Only hosts or attendees can invite" }, { status: 403 });
      }
    } else if (jam.visibility === "private") {
      if (!jam.guests_can_invite) {
        return NextResponse.json({ error: "Host has disabled guest invites for this jam" }, { status: 403 });
      }
      const { data: rsvp } = await admin
        .from("jam_rsvps")
        .select("status")
        .eq("jam_id", jamId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (rsvp?.status !== "attending") {
        return NextResponse.json({ error: "Only hosts or attendees can invite" }, { status: 403 });
      }
    }
  }

  // Load inviter profile
  const { data: inviterProfile } = await admin
    .from("profiles")
    .select("display_name, username")
    .eq("id", user.id)
    .single();
  const inviterName = (inviterProfile as any)?.display_name ?? (inviterProfile as any)?.username ?? "Someone";

  const jamName = jam.name ?? "a jam";
  const startsAt = jam.starts_at
    ? new Date(jam.starts_at).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://singjam.org";

  if (inviteeUserId) {
    // Member invite — check not already invited
    const { data: existing } = await admin
      .from("jam_invites")
      .select("id, status")
      .eq("jam_id", jamId)
      .eq("invited_user_id", inviteeUserId)
      .maybeSingle();

    if (existing && existing.status !== "declined") {
      return NextResponse.json({ error: "Already invited" }, { status: 409 });
    }

    // Upsert invite
    let token: string;
    if (existing) {
      await admin.from("jam_invites").update({ status: "pending", invited_by: user.id }).eq("id", existing.id);
      const { data: updated } = await admin.from("jam_invites").select("token").eq("id", existing.id).single();
      token = (updated as any).token;
    } else {
      const { data: inserted } = await admin.from("jam_invites").insert({
        jam_id: jamId,
        invited_user_id: inviteeUserId,
        invited_by: user.id,
        status: "pending",
      }).select("token").single();
      token = (inserted as any).token;
    }

    // Get invitee email
    const { data: authData } = await admin.auth.admin.getUserById(inviteeUserId);
    const email = authData.user?.email;

    // Get invitee profile for greeting
    const { data: inviteeProfile } = await admin.from("profiles").select("display_name, username").eq("id", inviteeUserId).single();
    const inviteeName = (inviteeProfile as any)?.display_name ?? (inviteeProfile as any)?.username ?? null;

    const jamUrl = `${baseUrl}/jam/${jamId}`;

    if (email) {
      await resend.emails.send({
        from: FROM_ADDRESS,
        to: email,
        subject: `${inviterName} invited you to ${jamName}`,
        html: memberInviteHtml({ inviterName, inviteeName, jamName, startsAt, jamUrl }),
      });
    }

    // Create in-app notification
    await createNotification({
      userId: inviteeUserId,
      type: "jam_invite",
      title: `${inviterName} invited you to ${jamName}`,
      body: startsAt ?? undefined,
      link: `/jam/${jamId}`,
    });

    return NextResponse.json({ ok: true });
  }

  // Non-member email invite
  if (inviteeEmail) {
    // Check if this email is already a member
    const { data: existingUser } = await admin.auth.admin.listUsers();
    const match = existingUser?.users?.find((u) => u.email?.toLowerCase() === inviteeEmail.toLowerCase());

    if (match) {
      // Redirect caller to use the member flow
      return NextResponse.json({ existingMemberId: match.id }, { status: 200 });
    }

    // Insert invite with no user_id but with email
    const { data: inserted } = await admin.from("jam_invites").insert({
      jam_id: jamId,
      invitee_email: inviteeEmail,
      invited_by: user.id,
      status: "pending",
    }).select("token").single();
    const token = (inserted as any).token;

    const signupUrl = `${baseUrl}/jam/${jamId}?invite=${token}`;

    await resend.emails.send({
      from: FROM_ADDRESS,
      to: inviteeEmail,
      subject: `${inviterName} invited you to join SingJam`,
      html: nonMemberInviteHtml({ inviterName, jamName, startsAt, signupUrl }),
    });

    return NextResponse.json({ ok: true });
  }
}
