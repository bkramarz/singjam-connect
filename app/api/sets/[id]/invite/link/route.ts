import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: setId } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await _req.json().catch(() => ({}));
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
      .maybeSingle();
    if (!collab) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Non-owners can only issue editor links
  const role: "editor" | "viewer" = isOwner && body.role === "viewer" ? "viewer" : "editor";

  const { data: inserted } = await admin
    .from("set_collaborators")
    .insert({ set_id: setId, invited_by: user.id, role })
    .select("id, token")
    .single();

  const { id: inviteId, token } = inserted as any;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://singjam.org";
  const url = `${baseUrl}/set/${setId}?invite=${token}`;
  const message = `Join my set list! ${(set as any).name}: ${url}`;

  return NextResponse.json({ inviteId, url, message });
}

// Removes a collaborator or cancels a pending link invite
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: setId } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { inviteId } = await req.json();
  if (!inviteId) return NextResponse.json({ error: "Missing inviteId" }, { status: 400 });

  const admin = supabaseAdmin();

  // Allow removal if the caller is the set owner or was the one who created the invite
  const { data: set } = await admin
    .from("sets")
    .select("owner_user_id")
    .eq("id", setId)
    .maybeSingle();

  const isOwner = (set as any)?.owner_user_id === user.id;

  if (!isOwner) {
    // Non-owners can only cancel their own pending (unclaimed) invites
    await admin.from("set_collaborators").delete()
      .eq("id", inviteId)
      .eq("invited_by", user.id)
      .is("user_id", null);
  } else {
    await admin.from("set_collaborators").delete()
      .eq("id", inviteId);
  }

  return NextResponse.json({ ok: true });
}
