import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { resolveApiUser } from "@/lib/supabase/apiUser";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: setId } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = supabaseAdmin();

  const { data: set } = await admin
    .from("sets")
    .select("owner_user_id, link_sharing")
    .eq("id", setId)
    .maybeSingle();

  if (!set) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = user?.id === (set as any).owner_user_id;

  if (!isOwner && (set as any).link_sharing !== "public") {
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: collab } = await admin
      .from("set_collaborators")
      .select("id")
      .eq("set_id", setId)
      .eq("user_id", user.id)
      .eq("status", "accepted")
      .maybeSingle();
    if (!collab) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("set_songs")
    .select("id, song_id, position, songs(title, display_artist, slug, chord_chart_url, youtube_url, spotify_url, song_recording_artists(position, youtube_url))")
    .eq("set_id", setId)
    .order("position", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ songs: data ?? [] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: setId } = await params;
  const user = await resolveApiUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { songId, confidence } = await req.json();
  if (!songId) return NextResponse.json({ error: "songId is required" }, { status: 400 });

  const admin = supabaseAdmin();

  const [ownerRes, collabRes] = await Promise.all([
    admin.from("sets").select("id").eq("id", setId).eq("owner_user_id", user.id).maybeSingle(),
    admin.from("set_collaborators").select("id").eq("set_id", setId).eq("user_id", user.id).eq("status", "accepted").maybeSingle(),
  ]);
  if (!ownerRes.data && !collabRes.data) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (confidence && ["lead", "support", "learn"].includes(confidence)) {
    await admin
      .from("user_songs")
      .upsert({ user_id: user.id, song_id: songId, confidence }, { onConflict: "user_id,song_id" });
  }

  const { data: maxRow } = await admin
    .from("set_songs")
    .select("position")
    .eq("set_id", setId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = maxRow ? (maxRow as any).position + 1 : 0;

  const { data, error } = await admin
    .from("set_songs")
    .insert({ set_id: setId, song_id: songId, position, added_by_user_id: user.id })
    .select("id, song_id, position, key_note, played, leader_user_ids, songs(title, display_artist, slug, chord_chart_url, youtube_url, tonality, song_recording_artists(position, youtube_url, spotify_url))")
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Song already in set" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: knowledge } = await admin
    .from("user_songs")
    .select("user_id, song_id, confidence")
    .eq("song_id", songId);

  return NextResponse.json({ song: data, knowledge: knowledge ?? [] });
}
