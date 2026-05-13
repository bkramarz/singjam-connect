import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { resend, FROM_ADDRESS } from "@/lib/resend";
import { createNotification } from "@/lib/notifications";
import { setCollaboratorInviteHtml, setCollaboratorNonMemberInviteHtml } from "@/emails/set-invite";

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
  const { id: setId } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { inviteeUserId, inviteeEmail, role } = await req.json();
  if (!inviteeUserId && !inviteeEmail) {
    return NextResponse.json({ error: "Provide inviteeUserId or inviteeEmail" }, { status: 400 });
  }
  let collaboratorRole: "editor" | "viewer" = role === "viewer" ? "viewer" : "editor";

  const admin = supabaseAdmin();

  const { data: set } = await admin
    .from("sets")
    .select("id, name, owner_user_id")
    .eq("id", setId)
    .maybeSingle();
  if (!set) return NextResponse.json({ error: "Set not found" }, { status: 404 });

  const isOwner = (set as any).owner_user_id === user.id;
  if (!isOwner) {
    const { data: collab } = await admin
      .from("set_collaborators")
      .select("id")
      .eq("set_id", setId)
      .eq("user_id", user.id)
      .eq("status", "accepted")
      .eq("role", "editor")
      .maybeSingle();
    if (!collab) return NextResponse.json({ error: "Only editors can invite collaborators" }, { status: 403 });
  }

  // Non-owners can only invite as editor regardless of what was requested
  if (!isOwner) collaboratorRole = "editor";

  const { data: inviterProfile } = await admin
    .from("profiles")
    .select("display_name, username")
    .eq("id", user.id)
    .single();
  const inviterName = (inviterProfile as any)?.display_name ?? (inviterProfile as any)?.username ?? "Someone";

  const setName = (set as any).name ?? "a set";
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://singjam.org";
  const setUrl = `${baseUrl}/set/${setId}`;

  if (inviteeUserId) {
    const { data: existing } = await admin
      .from("set_collaborators")
      .select("id")
      .eq("set_id", setId)
      .eq("user_id", inviteeUserId)
      .eq("status", "accepted")
      .maybeSingle();
    if (existing) return NextResponse.json({ error: "Already a collaborator" }, { status: 409 });

    const { data: newCollab } = await admin
      .from("set_collaborators")
      .insert({
        set_id: setId,
        user_id: inviteeUserId,
        invited_by: user.id,
        status: "accepted",
        role: collaboratorRole,
      })
      .select("id, user_id, status, role, profiles!user_id(display_name, last_name, username, avatar_url)")
      .single();

    const inviteeName = (newCollab as any)?.profiles?.display_name ?? (newCollab as any)?.profiles?.username ?? null;

    const { data: authData } = await admin.auth.admin.getUserById(inviteeUserId);
    const email = authData.user?.email;
    if (email) {
      await resend.emails.send({
        from: FROM_ADDRESS,
        to: email,
        subject: `${inviterName} added you to "${setName}"`,
        html: setCollaboratorInviteHtml({ inviterName, inviteeName, setName, role: collaboratorRole, setUrl }),
      });
    }

    await createNotification({
      userId: inviteeUserId,
      type: "set_collaborator_added",
      title: `${inviterName} added you to "${setName}"`,
      link: `/set/${setId}`,
    });

    return NextResponse.json({ ok: true, collaborator: newCollab });
  }

  // Email invite
  if (inviteeEmail) {
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    const match = existingUsers?.users?.find((u) => u.email?.toLowerCase() === inviteeEmail.toLowerCase());

    if (match) {
      // Redirect caller to use the user ID flow
      return NextResponse.json({ existingMemberId: match.id }, { status: 200 });
    }

    // Non-member: generate a link invite and email it
    const { data: inserted } = await admin
      .from("set_collaborators")
      .insert({ set_id: setId, invited_by: user.id, role: collaboratorRole })
      .select("token")
      .single();
    const token = (inserted as any).token;
    const signupUrl = `${baseUrl}/set/${setId}?invite=${token}`;

    await resend.emails.send({
      from: FROM_ADDRESS,
      to: inviteeEmail,
      subject: `${inviterName} invited you to collaborate on SingJam`,
      html: setCollaboratorNonMemberInviteHtml({ inviterName, setName, signupUrl }),
    });

    return NextResponse.json({ ok: true });
  }
}
