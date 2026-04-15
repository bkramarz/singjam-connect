import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jamId } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();

  const { data: jam } = await admin
    .from("jams")
    .select("id, name, starts_at, visibility, host_user_id, guests_can_invite")
    .eq("id", jamId)
    .single();
  if (!jam) return NextResponse.json({ error: "Jam not found" }, { status: 404 });
  if (jam.visibility === "official") {
    return NextResponse.json({ error: "Official events don't use invites" }, { status: 400 });
  }

  // Permission check (same rules as /invite)
  const isHost = jam.host_user_id === user.id;
  if (!isHost) {
    const { data: rsvp } = await admin
      .from("jam_rsvps")
      .select("status")
      .eq("jam_id", jamId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (rsvp?.status !== "attending") {
      return NextResponse.json({ error: "Only hosts or attendees can share invite links" }, { status: 403 });
    }

    if (jam.visibility === "private" && !jam.guests_can_invite) {
      return NextResponse.json({ error: "Host has disabled guest invites for this jam" }, { status: 403 });
    }
  }

  const { data: inserted } = await admin
    .from("jam_invites")
    .insert({ jam_id: jamId, invited_by: user.id, status: "pending" })
    .select("id, token")
    .single();

  const { id: inviteId, token } = inserted as any;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://singjam.org";
  const url = `${baseUrl}/jam/${jamId}?invite=${token}`;

  const jamName = jam.name ?? "a jam";
  const startsAt = jam.starts_at
    ? new Date(jam.starts_at).toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const message = startsAt
    ? `Come jam with me! ${jamName} — ${startsAt}: ${url}`
    : `Come jam with me! ${jamName}: ${url}`;

  return NextResponse.json({ inviteId, url, message });
}

// Called when the user cancels the share sheet — removes the dangling invite record
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { inviteId } = await req.json();
  if (!inviteId) return NextResponse.json({ error: "Missing inviteId" }, { status: 400 });

  const admin = supabaseAdmin();
  // Only delete if it's a link-only invite (no recipient) created by this user
  await admin
    .from("jam_invites")
    .delete()
    .eq("id", inviteId)
    .eq("invited_by", user.id)
    .is("invited_user_id", null)
    .is("invitee_email", null);

  return NextResponse.json({ ok: true });
}
