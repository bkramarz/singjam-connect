import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [setRes, songsRes] = await Promise.all([
    supabase
      .from("sets")
      .select("name, description, owner_user_id, link_sharing")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("set_songs")
      .select("song_id, position, key_note")
      .eq("set_id", id)
      .order("position", { ascending: true }),
  ]);

  const set = setRes.data as any;
  if (!set) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (set.owner_user_id !== user.id && set.link_sharing !== "public") {
    const { data: collab } = await supabase
      .from("set_collaborators")
      .select("id")
      .eq("set_id", id)
      .eq("user_id", user.id)
      .eq("status", "accepted")
      .maybeSingle();
    if (!collab) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: newSet, error: createError } = await supabase
    .from("sets")
    .insert({
      name: `Copy of ${set.name}`,
      description: set.description,
      owner_user_id: user.id,
    })
    .select("id")
    .single();

  if (createError || !newSet) {
    return NextResponse.json({ error: createError?.message ?? "Failed to create copy" }, { status: 500 });
  }

  const newSetId = (newSet as any).id;
  const songs = (songsRes.data ?? []) as any[];

  if (songs.length > 0) {
    await supabase.from("set_songs").insert(
      songs.map((s) => ({
        set_id: newSetId,
        song_id: s.song_id,
        position: s.position,
        key_note: s.key_note ?? null,
        added_by_user_id: user.id,
      }))
    );
  }

  return NextResponse.json({ id: newSetId });
}
