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

function getYoutubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0] || null;
    if (u.hostname.includes("youtube.com")) {
      return u.searchParams.get("v")
        ?? u.pathname.match(/\/(?:embed|v|shorts)\/([^/?]+)/)?.[1]
        ?? null;
    }
    return null;
  } catch { return null; }
}

async function getAccessToken(): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.YOUTUBE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const { access_token } = await res.json();
  return access_token ?? null;
}

// Returns false if the playlist was not found (deleted), throws on other failures
async function clearPlaylistItems(playlistId: string, access_token: string): Promise<boolean> {
  let pageToken: string | undefined;
  const itemIds: string[] = [];

  do {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("part", "id");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("maxResults", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (res.status === 404) return false;
    if (!res.ok) throw new Error(`YouTube list failed: ${res.status}`);
    const data = await res.json();
    itemIds.push(...(data.items ?? []).map((i: any) => i.id));
    pageToken = data.nextPageToken;
  } while (pageToken);

  for (const id of itemIds) {
    await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${access_token}` },
    });
  }
  return true;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: setId } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const access_token = await getAccessToken();
  if (!access_token) return NextResponse.json({ error: "Could not authenticate with YouTube" }, { status: 500 });

  const admin = supabaseAdmin();
  const [setRes, songsRes] = await Promise.all([
    admin.from("sets").select("name, youtube_playlist_id").eq("id", setId).single(),
    admin
      .from("set_songs")
      .select("position, songs(title, youtube_url, song_recording_artists(position, youtube_url))")
      .eq("set_id", setId)
      .order("position", { ascending: true }),
  ]);
  if (!setRes.data) return NextResponse.json({ error: "Set not found" }, { status: 404 });

  let playlistId = setRes.data.youtube_playlist_id as string | null;

  if (playlistId) {
    try {
      const exists = await clearPlaylistItems(playlistId, access_token);
      if (!exists) {
        // Playlist was deleted from YouTube; clear stored ID and create a fresh one
        await admin.from("sets").update({ youtube_playlist_id: null }).eq("id", setId);
        playlistId = null;
      }
    } catch {
      return NextResponse.json({ error: "Failed to clear YouTube playlist" }, { status: 502 });
    }
  }

  if (!playlistId) {
    const playlistRes = await fetch("https://www.googleapis.com/youtube/v3/playlists?part=snippet,status", {
      method: "POST",
      headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        snippet: { title: setRes.data.name, description: "Created from SingJam" },
        status: { privacyStatus: "unlisted" },
      }),
    });
    if (!playlistRes.ok) return NextResponse.json({ error: "Failed to create playlist" }, { status: 502 });
    const data = await playlistRes.json();
    playlistId = data.id;
    await admin.from("sets").update({ youtube_playlist_id: playlistId }).eq("id", setId);
  }

  const songs = (songsRes.data ?? []) as any[];
  let added = 0;
  const fingerprint: string[] = [];

  for (const song of songs) {
    const s = song.songs as any;
    const artists = [...(s.song_recording_artists ?? [])].sort((a: any, b: any) => a.position - b.position);
    const videoId = getYoutubeId(artists.find((a: any) => a.youtube_url)?.youtube_url ?? s.youtube_url);
    if (!videoId) continue;
    const itemRes = await fetch("https://www.googleapis.com/youtube/v3/playlistItems?part=snippet", {
      method: "POST",
      headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ snippet: { playlistId, resourceId: { kind: "youtube#video", videoId } } }),
    });
    if (itemRes.ok) { added++; fingerprint.push(videoId); }
  }

  const fingerprintStr = fingerprint.join(",");
  await admin.from("sets").update({ youtube_playlist_fingerprint: fingerprintStr }).eq("id", setId);

  return NextResponse.json({ url: `https://www.youtube.com/playlist?list=${playlistId}`, added, total: songs.length, fingerprint: fingerprintStr });
}
