import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resend, FROM_ADDRESS } from "@/lib/resend";
import { jamHostMessageHtml } from "@/emails/jam-host-message";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jamId } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const subject = (body.subject ?? "").trim();
  const message = (body.message ?? "").trim();
  const audience: "attending" | "all_invited" = body.audience === "all_invited" ? "all_invited" : "attending";

  if (!subject || !message) {
    return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // Verify caller is the jam host
  const { data: jam } = await admin
    .from("jams")
    .select("host_user_id, name")
    .eq("id", jamId)
    .single();

  if (!jam) return NextResponse.json({ error: "Jam not found" }, { status: 404 });
  if (jam.host_user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Get host display name
  const { data: hostProfile } = await admin
    .from("profiles")
    .select("display_name, username")
    .eq("id", user.id)
    .single();
  const hostName = (hostProfile as any)?.display_name ?? (hostProfile as any)?.username ?? "Your host";

  const jamUrl = `https://singjam.org/jam/${jamId}`;
  const jamName = jam.name ?? "Your jam";

  // Collect recipients — keyed by email to deduplicate
  const recipientMap = new Map<string, string | null>(); // email → name

  // Always include attending RSVPs
  const { data: rsvps } = await admin
    .from("jam_rsvps")
    .select("user_id")
    .eq("jam_id", jamId)
    .eq("status", "attending");

  const rsvpIds = (rsvps ?? []).map((r) => r.user_id).filter((id) => id !== user.id);

  await Promise.all(
    rsvpIds.map(async (userId) => {
      const [{ data: profile }, { data: authData }] = await Promise.all([
        admin.from("profiles").select("display_name, username").eq("id", userId).single(),
        admin.auth.admin.getUserById(userId),
      ]);
      const email = authData.user?.email;
      if (email) {
        recipientMap.set(email, (profile as any)?.display_name ?? (profile as any)?.username ?? null);
      }
    })
  );

  // If "all_invited", also include pending invitees
  if (audience === "all_invited") {
    const { data: pendingInvites } = await admin
      .from("jam_invites")
      .select("invited_user_id, invitee_email")
      .eq("jam_id", jamId)
      .eq("status", "pending");

    await Promise.all(
      (pendingInvites ?? []).map(async (inv) => {
        if (inv.invited_user_id) {
          const [{ data: profile }, { data: authData }] = await Promise.all([
            admin.from("profiles").select("display_name, username").eq("id", inv.invited_user_id).single(),
            admin.auth.admin.getUserById(inv.invited_user_id),
          ]);
          const email = authData.user?.email;
          if (email && !recipientMap.has(email)) {
            recipientMap.set(email, (profile as any)?.display_name ?? (profile as any)?.username ?? null);
          }
        } else if (inv.invitee_email && !recipientMap.has(inv.invitee_email)) {
          recipientMap.set(inv.invitee_email, null);
        }
      })
    );
  }

  await Promise.all(
    Array.from(recipientMap.entries()).map(([email, name]) =>
      resend.emails.send({
        from: FROM_ADDRESS,
        to: email,
        subject: `[${jamName}] ${subject}`,
        html: jamHostMessageHtml({ recipientName: name, hostName, jamName, jamUrl, subject, body: message }),
      })
    )
  );

  return NextResponse.json({ sent: recipientMap.size });
}
