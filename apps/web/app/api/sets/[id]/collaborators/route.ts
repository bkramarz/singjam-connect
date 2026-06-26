import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { resend, FROM_ADDRESS } from "@/lib/resend";
import { createNotification } from "@/lib/notifications";
import { setAccessGrantedHtml } from "@/emails/set-access-granted";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: setId } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { collaboratorId, role } = await req.json();
  if (!collaboratorId || !role) {
    return NextResponse.json({ error: "Missing collaboratorId or role" }, { status: 400 });
  }
  if (role !== "editor" && role !== "viewer") {
    return NextResponse.json({ error: "role must be editor or viewer" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  const { data: set } = await admin
    .from("sets")
    .select("owner_user_id")
    .eq("id", setId)
    .maybeSingle();
  if (!set) return NextResponse.json({ error: "Set not found" }, { status: 404 });
  if ((set as any).owner_user_id !== user.id) {
    return NextResponse.json({ error: "Only the set owner can change roles" }, { status: 403 });
  }

  const { data: existing } = await admin
    .from("set_collaborators")
    .select("user_id, status")
    .eq("id", collaboratorId)
    .eq("set_id", setId)
    .maybeSingle();

  const { error } = await admin
    .from("set_collaborators")
    .update({ role, status: "accepted" })
    .eq("id", collaboratorId)
    .eq("set_id", setId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify requester only when approving a pending request (not a role change on an existing collaborator)
  if (existing?.user_id && (existing as any).status !== "accepted") {
    const { data: setData } = await admin
      .from("sets")
      .select("name")
      .eq("id", setId)
      .maybeSingle();

    const setName = (setData as any)?.name ?? "a set list";
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://singjam.org";
    const setUrl = `${baseUrl}/set/${setId}`;

    await createNotification({
      userId: existing.user_id,
      type: "set_access_granted",
      title: `You've been granted access to "${setName}"`,
      link: `/set/${setId}`,
    });

    const { data: requesterAuth } = await admin.auth.admin.getUserById(existing.user_id);
    const requesterEmail = requesterAuth.user?.email;
    if (requesterEmail) {
      await resend.emails.send({
        from: FROM_ADDRESS,
        to: requesterEmail,
        subject: `You've been granted access to "${setName}"`,
        html: setAccessGrantedHtml({ setName, setUrl }),
      });
    }
  }

  return NextResponse.json({ ok: true });
}
