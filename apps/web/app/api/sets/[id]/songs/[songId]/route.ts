import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; songId: string }> }
) {
  const { id: setId, songId } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();

  const [ownerRes, collabRes] = await Promise.all([
    admin.from("sets").select("id").eq("id", setId).eq("owner_user_id", user.id).maybeSingle(),
    admin.from("set_collaborators").select("id").eq("set_id", setId).eq("user_id", user.id).eq("status", "accepted").in("role", ["editor", "co-owner"]).maybeSingle(),
  ]);
  if (!ownerRes.data && !collabRes.data) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if ("key_note" in body) updates.key_note = body.key_note as string | null;
  if ("played" in body) updates.played = Boolean(body.played);
  if ("leader_user_ids" in body && Array.isArray(body.leader_user_ids)) {
    updates.leader_user_ids = body.leader_user_ids;
    if (body.leader_user_ids.length > 0) {
      await admin.from("user_songs").upsert(
        body.leader_user_ids.map((userId: string) => ({ user_id: userId, song_id: songId, confidence: "lead" })),
        { onConflict: "user_id,song_id" }
      );
    }
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "No valid fields" }, { status: 400 });

  const { error } = await admin
    .from("set_songs")
    .update(updates)
    .eq("set_id", setId)
    .eq("song_id", songId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; songId: string }> }
) {
  const { id: setId, songId } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();

  const [ownerRes, collabRes] = await Promise.all([
    admin.from("sets").select("id").eq("id", setId).eq("owner_user_id", user.id).maybeSingle(),
    admin.from("set_collaborators").select("id").eq("set_id", setId).eq("user_id", user.id).eq("status", "accepted").in("role", ["editor", "co-owner"]).maybeSingle(),
  ]);
  if (!ownerRes.data && !collabRes.data) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await admin
    .from("set_songs")
    .delete()
    .eq("set_id", setId)
    .eq("song_id", songId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
