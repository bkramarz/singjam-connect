import { NextRequest, NextResponse } from "next/server";

// ─── MusicBrainz ─────────────────────────────────────────────────────────────
async function enrichMusicBrainz(title: string, artist: string) {
  const q = artist
    ? `recording:"${title}" AND artist:"${artist}"`
    : `recording:"${title}"`;

  const res = await fetch(
    `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(q)}&fmt=json&limit=3`,
    {
      headers: {
        "User-Agent": "SingJamConnect/1.0 (https://singjam.connect)",
        Accept: "application/json",
      },
    }
  );

  if (!res.ok) return null;
  const data = await res.json();
  const rec = data.recordings?.[0];
  if (!rec) return null;

  const year = rec["first-release-date"]
    ? parseInt(rec["first-release-date"].slice(0, 4))
    : undefined;

  const displayArtist = rec["artist-credit"]?.[0]?.artist?.name;

  const languages: string[] = [];
  if (rec.language) languages.push(rec.language);

  // Fetch work relations for composer/lyricist
  let composers: string[] = [];
  let lyricists: string[] = [];

  if (rec.relations) {
    for (const rel of rec.relations) {
      if (rel.type === "composer" && rel.artist?.name)
        composers.push(rel.artist.name);
      if (rel.type === "lyricist" && rel.artist?.name)
        lyricists.push(rel.artist.name);
    }
  }

  const recordingArtists = (rec["artist-credit"] ?? [])
    .map((ac: any) => ac.artist?.name)
    .filter(Boolean);

  return {
    year,
    display_artist: displayArtist,
    languages,
    composers,
    lyricists,
    recording_artists: recordingArtists,
  };
}


// ─── Spotify ──────────────────────────────────────────────────────────────────
async function getSpotifyToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token ?? null;
}

async function enrichSpotify(title: string, artist: string) {
  const token = await getSpotifyToken();
  if (!token) return null;

  const q = artist ? `track:${title} artist:${artist}` : `track:${title}`;
  const searchRes = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!searchRes.ok) return null;
  const searchData = await searchRes.json();
  const track = searchData.tracks?.items?.[0];
  if (!track) return null;

  // Fetch audio features for energy
  const featRes = await fetch(
    `https://api.spotify.com/v1/audio-features/${track.id}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  let energyRaw: number | undefined;
  if (featRes.ok) {
    const feat = await featRes.json();
    // Spotify energy is 0.0–1.0, map to 1–5
    if (typeof feat.energy === "number") {
      energyRaw = Math.max(1, Math.min(5, Math.round(feat.energy * 5)));
    }
  }

  // Fetch artist genres
  const artistId = track.artists?.[0]?.id;
  let genres: string[] = [];
  if (artistId) {
    const artistRes = await fetch(
      `https://api.spotify.com/v1/artists/${artistId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (artistRes.ok) {
      const artistData = await artistRes.json();
      genres = artistData.genres?.slice(0, 5) ?? [];
    }
  }

  // Spotify popularity is 0–100, map to 1–5
  const popularity =
    typeof track.popularity === "number"
      ? Math.max(1, Math.min(5, Math.round(track.popularity / 20)))
      : undefined;

  return {
    popularity,
    energy: energyRaw,
    genres,
  };
}


// ─── Genius ──────────────────────────────────────────────────────────────────
async function enrichGenius(title: string, artist: string) {
  const token = process.env.GENIUS_ACCESS_TOKEN;
  if (!token) return null;

  const q = artist ? `${title} ${artist}` : title;
  const res = await fetch(
    `https://api.genius.com/search?q=${encodeURIComponent(q)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) return null;
  const data = await res.json();
  const hit = data.response?.hits?.[0]?.result;
  if (!hit) return null;

  return {
    lyrics_url: hit.url as string,
    // Genius API doesn't return lyrics text — the URL lets the admin copy the first line manually
    first_line: undefined as string | undefined,
  };
}


// ─── Handler ─────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get("title") ?? "";
  const artist = req.nextUrl.searchParams.get("artist") ?? "";

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const [musicbrainz, spotify, genius] = await Promise.allSettled([
    enrichMusicBrainz(title, artist),
    enrichSpotify(title, artist),
    enrichGenius(title, artist),
  ]);

  return NextResponse.json({
    musicbrainz: musicbrainz.status === "fulfilled" ? musicbrainz.value : null,
    spotify: spotify.status === "fulfilled" ? spotify.value : null,
    genius: genius.status === "fulfilled" ? genius.value : null,
  });
}
