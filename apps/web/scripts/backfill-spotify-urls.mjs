// One-off backfill: fetches Spotify URLs for all song_recording_artists rows that don't have one.
// Run: node scripts/backfill-spotify-urls.mjs
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, "../.env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const SPOTIFY_CLIENT_ID = env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = env.SPOTIFY_CLIENT_SECRET;

async function getSpotifyToken() {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  return data.access_token;
}

async function searchSpotify(token, title, artistName) {
  const q = encodeURIComponent(`track:${title} artist:${artistName}`);
  const res = await fetch(`https://api.spotify.com/v1/search?q=${q}&type=track&limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.tracks?.items?.[0]?.external_urls?.spotify ?? null;
}

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SB_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`  Supabase error: ${options.method ?? "GET"} ${path} → ${res.status}`, body.slice(0, 200));
    return null;
  }
  return options.method === "PATCH" ? true : res.json();
}

// ── Main ──────────────────────────────────────────────────────────────────────

const token = await getSpotifyToken();
if (!token) {
  console.error("Failed to get Spotify token. Check SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.");
  process.exit(1);
}
console.log("Spotify token acquired.\n");

const rows = await sbFetch(
  "/song_recording_artists?select=song_id,artist_id,songs(title),artists(name)&spotify_url=is.null"
);

if (!rows || rows.length === 0) {
  console.log("No rows missing spotify_url.");
  process.exit(0);
}

console.log(`Found ${rows.length} song_recording_artists rows without a Spotify URL.\n`);

let found = 0;
let notFound = 0;

for (const row of rows) {
  const title = row.songs?.title;
  const artistName = row.artists?.name;

  if (!title || !artistName) {
    console.log(`  Skipping row with missing title or artist (song_id: ${row.song_id})`);
    notFound++;
    continue;
  }

  const spotifyUrl = await searchSpotify(token, title, artistName);

  if (spotifyUrl) {
    await sbFetch(
      `/song_recording_artists?song_id=eq.${row.song_id}&artist_id=eq.${row.artist_id}`,
      { method: "PATCH", body: JSON.stringify({ spotify_url: spotifyUrl }) }
    );
    console.log(`  ✅ "${title}" — ${artistName}`);
    found++;
  } else {
    console.log(`  ❌ "${title}" — ${artistName} (no match)`);
    notFound++;
  }
}

console.log(`\nDone. Found: ${found}, Not found: ${notFound}.`);
