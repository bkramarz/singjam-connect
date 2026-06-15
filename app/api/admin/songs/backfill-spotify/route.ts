import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin as admin } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const db = admin();
  const { data, error } = await db
    .from("song_recording_artists")
    .select("song_id, artist_id, position, songs(title, display_artist), artists(name)")
    .is("spotify_url", null)
    .order("song_id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const pending = (data ?? []).map((row: any) => ({
    song_id: row.song_id,
    artist_id: row.artist_id,
    position: row.position,
    title: row.songs?.title ?? "",
    display_artist: row.songs?.display_artist ?? null,
    artist_name: row.artists?.name ?? "",
  }));

  return NextResponse.json({ pending });
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { song_id, artist_id, spotify_url } = await req.json();
  if (!song_id || !artist_id || !spotify_url) {
    return NextResponse.json({ error: "song_id, artist_id, and spotify_url are required" }, { status: 400 });
  }

  const db = admin();
  const { error } = await db
    .from("song_recording_artists")
    .update({ spotify_url })
    .eq("song_id", song_id)
    .eq("artist_id", artist_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
