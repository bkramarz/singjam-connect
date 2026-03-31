import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { resend, FROM_ADDRESS } from "@/lib/resend";
import { jamWaitlistPromotedHtml } from "@/emails/jam-waitlist-promoted";

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

  // Get jam capacity
  const { data: jam } = await admin.from("jams").select("capacity, name, starts_at, visibility").eq("id", jamId).single();
  if (!jam) return NextResponse.json({ error: "Jam not found" }, { status: 404 });
  if (jam.visibility === "official") return NextResponse.json({ error: "Official events use external ticketing" }, { status: 400 });

  // Count current attendees
  const { count: attendingCount } = await admin
    .from("jam_rsvps")
    .select("id", { count: "exact", head: true })
    .eq("jam_id", jamId)
    .eq("status", "attending");

  const isFull = jam.capacity !== null && (attendingCount ?? 0) >= jam.capacity;

  // Check for existing RSVP
  const { data: existing } = await admin
    .from("jam_rsvps")
    .select("id, status")
    .eq("jam_id", jamId)
    .eq("user_id", user.id)
    .maybeSingle();

  let newStatus: "attending" | "waitlist" = isFull ? "waitlist" : "attending";
  let waitlistPosition: number | null = null;

  if (isFull) {
    const { count: waitlistCount } = await admin
      .from("jam_rsvps")
      .select("id", { count: "exact", head: true })
      .eq("jam_id", jamId)
      .eq("status", "waitlist");
    waitlistPosition = (waitlistCount ?? 0) + 1;
  }

  if (existing) {
    await admin.from("jam_rsvps").update({ status: newStatus, waitlist_position: waitlistPosition }).eq("id", existing.id);
  } else {
    await admin.from("jam_rsvps").insert({ jam_id: jamId, user_id: user.id, status: newStatus, waitlist_position: waitlistPosition });
  }

  return NextResponse.json({ status: newStatus, waitlist_position: waitlistPosition });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jamId } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();

  const { data: rsvp } = await admin
    .from("jam_rsvps")
    .select("id, status")
    .eq("jam_id", jamId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!rsvp) return NextResponse.json({ error: "RSVP not found" }, { status: 404 });

  await admin.from("jam_rsvps").update({ status: "cancelled", waitlist_position: null }).eq("id", rsvp.id);

  // Promote first waitlist person if a confirmed spot opened up
  if (rsvp.status === "attending") {
    const { data: next } = await admin
      .from("jam_rsvps")
      .select("id, user_id")
      .eq("jam_id", jamId)
      .eq("status", "waitlist")
      .order("waitlist_position", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (next) {
      await admin.from("jam_rsvps").update({ status: "attending", waitlist_position: null }).eq("id", next.id);

      // Get their email and name for notification
      const [{ data: profile }, { data: authData }, { data: jam }] = await Promise.all([
        admin.from("profiles").select("display_name, username").eq("id", next.user_id).single(),
        admin.auth.admin.getUserById(next.user_id),
        admin.from("jams").select("name, starts_at").eq("id", jamId).single(),
      ]);

      const email = authData.user?.email;
      if (email) {
        await resend.emails.send({
          from: FROM_ADDRESS,
          to: email,
          subject: `You're in! A spot opened up at ${jam?.name ?? "the jam"}`,
          html: jamWaitlistPromotedHtml({
            name: (profile as any)?.display_name ?? (profile as any)?.username,
            jamName: jam?.name,
            jamUrl: `https://singjam.org/jam/${jamId}`,
            startsAt: jam?.starts_at,
          }),
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
