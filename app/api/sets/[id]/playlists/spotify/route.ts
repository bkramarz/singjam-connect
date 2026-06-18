import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

function getSpotifyTrackId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const match = new URL(url).pathname.match(/\/track\/([a-zA-Z0-9]+)/);
    return match?.[1] ?? null;
  } catch { return null; }
}

async function getAccessToken(): Promise<string | null> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID!}:${process.env.SPOTIFY_CLIENT_SECRET!}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.SPOTIFY_REFRESH_TOKEN!,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (body.error === "invalid_grant") {
      console.error("[Spotify] Refresh token expired or revoked — re-run the OAuth flow and update SPOTIFY_REFRESH_TOKEN.");
    }
    return null;
  }
  const { access_token } = await res.json();
  return access_token ?? null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: setId } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let songOrder: string[] | null = null;
  try {
    const body = await req.json();
    if (Array.isArray(body.songOrder)) songOrder = body.songOrder;
  } catch { /* no body */ }

  const { data: setOwner } = await supabase.from("sets").select("owner_user_id").eq("id", setId).single();
  if (!setOwner || setOwner.owner_user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const access_token = await getAccessToken();
  if (!access_token) return NextResponse.json({ error: "Could not authenticate with Spotify" }, { status: 500 });

  const admin = supabaseAdmin();
  const [setRes, songsRes] = await Promise.all([
    admin.from("sets").select("name, spotify_playlist_id").eq("id", setId).single(),
    admin
      .from("set_songs")
      .select("song_id, position, songs(song_recording_artists(position, spotify_url))")
      .eq("set_id", setId)
      .order("position", { ascending: true }),
  ]);
  if (!setRes.data) return NextResponse.json({ error: "Set not found" }, { status: 404 });

  let orderedSongs = (songsRes.data ?? []) as any[];
  if (songOrder?.length) {
    orderedSongs = [...orderedSongs].sort((a, b) => {
      const ai = songOrder!.indexOf(a.song_id);
      const bi = songOrder!.indexOf(b.song_id);
      return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
    });
  }

  const trackUris: string[] = [];
  for (const song of orderedSongs) {
    const artists = [...(song.songs?.song_recording_artists ?? [])].sort((a: any, b: any) => a.position - b.position);
    const trackId = getSpotifyTrackId(artists.find((a: any) => a.spotify_url)?.spotify_url);
    if (trackId) trackUris.push(`spotify:track:${trackId}`);
  }

  let playlistId = setRes.data.spotify_playlist_id as string | null;
  let playlistUrl = "";

  if (playlistId) {
    const replaceRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ uris: trackUris.slice(0, 100) }),
    });

    if (replaceRes.status === 404) {
      // Playlist was deleted from Spotify; clear stored ID and create a fresh one
      await admin.from("sets").update({ spotify_playlist_id: null }).eq("id", setId);
      playlistId = null;
    } else if (!replaceRes.ok) {
      return NextResponse.json({ error: "Failed to update Spotify playlist" }, { status: 502 });
    } else {
      for (let i = 100; i < trackUris.length; i += 100) {
        const addRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
          method: "POST",
          headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ uris: trackUris.slice(i, i + 100) }),
        });
        if (!addRes.ok) return NextResponse.json({ error: "Failed to add tracks to Spotify playlist" }, { status: 502 });
      }
      playlistUrl = `https://open.spotify.com/playlist/${playlistId}`;
    }
  }

  if (!playlistId) {
    const meRes = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!meRes.ok) return NextResponse.json({ error: "Could not get Spotify user" }, { status: 502 });
    const { id: spotifyUserId } = await meRes.json();

    const playlistRes = await fetch(`https://api.spotify.com/v1/users/${spotifyUserId}/playlists`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: setRes.data.name, description: "Created from SingJam", public: false }),
    });
    if (!playlistRes.ok) return NextResponse.json({ error: "Failed to create playlist" }, { status: 502 });
    const created = await playlistRes.json();
    playlistId = created.id;
    playlistUrl = created.external_urls.spotify;
    await admin.from("sets").update({ spotify_playlist_id: playlistId }).eq("id", setId);

    for (let i = 0; i < trackUris.length; i += 100) {
      const addRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ uris: trackUris.slice(i, i + 100) }),
      });
      if (!addRes.ok) return NextResponse.json({ error: "Failed to add tracks to Spotify playlist" }, { status: 502 });
    }
  }

  const fingerprintStr = trackUris.map(uri => uri.replace("spotify:track:", "")).join(",");
  await admin.from("sets").update({ spotify_playlist_fingerprint: fingerprintStr }).eq("id", setId);

  return NextResponse.json({
    url: playlistUrl,
    fingerprint: fingerprintStr,
    added: trackUris.length,
    total: orderedSongs.length,
  });
}
