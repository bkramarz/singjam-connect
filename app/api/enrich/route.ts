import { NextRequest, NextResponse } from "next/server";

const MB_HEADERS = {
  "User-Agent": "SingJamConnect/1.0 (https://github.com/bkramarz/singjam-connect)",
  Accept: "application/json",
};

// ─── MusicBrainz ─────────────────────────────────────────────────────────────

type WorkData = { composers: string[]; lyricists: string[]; languages: string[] };

async function fetchMBWorkArtists(workId: string): Promise<{ name: string; year: number | null }[]> {
  const res = await fetch(
    `https://musicbrainz.org/ws/2/recording?work=${workId}&inc=artist-credits&fmt=json&limit=100`,
    { headers: MB_HEADERS }
  );
  if (!res.ok) return [];
  const data = await res.json();

  const seen = new Set<string>();
  const result: { name: string; year: number | null }[] = [];

  const sorted = (data.recordings ?? [])
    .map((r: any) => ({
      name: (r["artist-credit"] ?? []).map((ac: any) => ac.artist?.name).filter(Boolean).join(" & "),
      year: r["first-release-date"] ? parseInt(r["first-release-date"].slice(0, 4)) : null,
    }))
    .filter((e: any) => e.name)
    .sort((a: any, b: any) => {
      if (a.year === null && b.year === null) return 0;
      if (a.year === null) return 1;
      if (b.year === null) return -1;
      return a.year - b.year;
    });

  for (const e of sorted) {
    if (!seen.has(e.name.toLowerCase())) {
      seen.add(e.name.toLowerCase());
      result.push(e);
    }
    if (result.length >= 5) break;
  }

  return result;
}

async function fetchMBWorkData(workId: string): Promise<WorkData> {
  const res = await fetch(
    `https://musicbrainz.org/ws/2/work/${workId}?inc=artist-rels&fmt=json`,
    { headers: MB_HEADERS }
  );
  if (!res.ok) return { composers: [], lyricists: [], languages: [] };
  const work = await res.json();

  const result: WorkData = { composers: [], lyricists: [], languages: [] };
  if (work.language) result.languages.push(work.language);
  for (const rel of (work.relations ?? [])) {
    const name: string | undefined = rel.artist?.name;
    if (!name) continue;
    if (rel.type === "composer") result.composers.push(name);
    if (rel.type === "lyricist") result.lyricists.push(name);
    if (rel.type === "writer") {
      result.composers.push(name);
      result.lyricists.push(name);
    }
  }
  return result;
}

async function enrichMusicBrainz(title: string, artist: string) {
  // Artist in the query dramatically improves accuracy
  const q = artist
    ? `recording:"${title}" AND artist:"${artist}"`
    : `recording:"${title}"`;

  const searchRes = await fetch(
    `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(q)}&fmt=json&limit=10`,
    { headers: MB_HEADERS }
  );
  if (!searchRes.ok) return null;

  const searchData = await searchRes.json();

  // Only trust results with score >= 80 — below that MB is guessing
  const recordings: any[] = (searchData.recordings ?? []).filter(
    (r: any) => (r.score ?? 0) >= 80
  );
  if (!recordings.length) return null;

  // Pick the one with the earliest release date (most likely the original)
  const best = recordings.sort((a: any, b: any) => {
    const aYear = a["first-release-date"] ? parseInt(a["first-release-date"]) : 9999;
    const bYear = b["first-release-date"] ? parseInt(b["first-release-date"]) : 9999;
    return aYear - bYear;
  })[0];

  // Full lookup with work relations to get composers/lyricists
  const lookupRes = await fetch(
    `https://musicbrainz.org/ws/2/recording/${best.id}?inc=artist-credits+work-rels&fmt=json`,
    { headers: MB_HEADERS }
  );
  if (!lookupRes.ok) return null;
  const rec = await lookupRes.json();

  const year = rec["first-release-date"]
    ? parseInt(rec["first-release-date"].slice(0, 4))
    : undefined;

  const recordingArtists: string[] = (rec["artist-credit"] ?? [])
    .map((ac: any) => ac.artist?.name)
    .filter(Boolean);

  const displayArtist = recordingArtists.join(" & ") || undefined;

  // Try work relation on the recording first
  let workData: WorkData = { composers: [], lyricists: [], languages: [] };
  const workRel = (rec.relations ?? []).find((r: any) => r["target-type"] === "work");

  let workId: string | undefined;
  if (workRel?.work?.id) {
    workId = workRel.work.id;
    workData = await fetchMBWorkData(workId!);
  } else {
    // Fallback: search works directly by title — covers songs without recording→work links
    const workQ = artist
      ? `work:"${title}" AND artist:"${artist}"`
      : `work:"${title}"`;
    const workSearchRes = await fetch(
      `https://musicbrainz.org/ws/2/work/?query=${encodeURIComponent(workQ)}&fmt=json&limit=5`,
      { headers: MB_HEADERS }
    );
    if (workSearchRes.ok) {
      const workSearchData = await workSearchRes.json();
      const bestWork = (workSearchData.works ?? []).find((w: any) => (w.score ?? 0) >= 80);
      if (bestWork?.id) {
        workId = bestWork.id;
        workData = await fetchMBWorkData(workId!);
      }
    }
  }

  const topArtists = workId ? await fetchMBWorkArtists(workId) : [];

  return {
    title: rec.title as string | undefined,
    year,
    display_artist: displayArtist,
    languages: workData.languages,
    composers: workData.composers,
    lyricists: workData.lyricists,
    recording_artists: recordingArtists,
    topArtists,
  };
}


// ─── Second Hand Songs ────────────────────────────────────────────────────────
const SHS_JSON_HEADERS = { "User-Agent": "SingJamConnect/1.0", Accept: "application/json" };
const SHS_HTML_HEADERS = { "User-Agent": "SingJamConnect/1.0" };

function normTitle(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

function extractDtField(html: string, ...labels: string[]): string[] {
  for (const label of labels) {
    const regex = new RegExp(`<dt[^>]*>${label}<\\/dt>\\s*<dd[^>]*>([\\s\\S]*?)<\\/dd>`);
    const match = html.match(regex);
    if (match) {
      return match[1].replace(/<[^>]+>/g, "").trim().split(/,\s*/).filter(Boolean);
    }
  }
  return [];
}

async function enrichSecondHandSongs(title: string, artist: string) {
  const searchRes = await fetch(
    `https://secondhandsongs.com/search/work?title=${encodeURIComponent(title)}&performer=${encodeURIComponent(artist)}`,
    { headers: SHS_JSON_HEADERS }
  );
  if (!searchRes.ok) return null;

  const searchData = await searchRes.json();
  const results: any[] = searchData.resultPage ?? [];
  if (!results.length) return null;

  const match = results.find((r) => normTitle(r.title) === normTitle(title)) ?? results[0];
  if (!match?.uri) return null;

  // Fetch work page for composers/lyricists (HTML, not JSON)
  const workRes = await fetch(match.uri, { headers: SHS_HTML_HEADERS });
  if (!workRes.ok) return null;
  const workHtml = await workRes.text();

  const composers = extractDtField(workHtml, "Music written by", "Written by");
  const lyricists = extractDtField(workHtml, "Lyrics written by");

  // Construct the versions URL using the work ID extracted from the URI
  const workId = match.uri.match(/\/work\/(\d+)/)?.[1];
  const versionsUrl = workId
    ? `https://secondhandsongs.com/work/${workId}/versions`
    : `${match.uri}/versions`;
  console.log("[SHS] versions URL:", versionsUrl);
  const versionsRes = await fetch(versionsUrl, { headers: SHS_HTML_HEADERS });
  let year: number | undefined;
  if (versionsRes.ok) {
    const versionsHtml = await versionsRes.text();
    const metaMatch = versionsHtml.match(/first released by (.+?) in (\d{4})/);
    if (metaMatch) year = parseInt(metaMatch[2]);
    console.log("[SHS] meta match:", metaMatch?.[0] ?? "no match");
  }

  console.log("[SHS] search match:", { uri: match.uri, title: match.title });
  console.log("[SHS] composers:", composers, "lyricists:", lyricists);

  return composers.length || lyricists.length ? { composers, lyricists, year } : null;
}


// ─── Wikidata ─────────────────────────────────────────────────────────────────
async function enrichWikidata(title: string, _artist: string) {
  // Escape title for SPARQL string literal
  const escaped = title.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  // Q7366 = song, Q2188189 = musical work/composition, Q105543609 = musical composition
  // P86 = composer, P676 = lyrics by
  const sparql = `
SELECT DISTINCT ?composerLabel ?lyricistLabel WHERE {
  VALUES ?types { wd:Q7366 wd:Q2188189 wd:Q105543609 }
  ?song wdt:P31 ?types ;
        rdfs:label ?label .
  FILTER(LANG(?label) = "en" && LCASE(STR(?label)) = LCASE("${escaped}"))
  OPTIONAL { ?song wdt:P86 ?composer . }
  OPTIONAL { ?song wdt:P676 ?lyricist . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
LIMIT 20`.trim();

  const res = await fetch(
    `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`,
    {
      headers: {
        "User-Agent": "SingJamConnect/1.0",
        Accept: "application/sparql-results+json",
      },
    }
  );
  if (!res.ok) return null;

  const data = await res.json();
  const bindings: any[] = data.results?.bindings ?? [];
  if (!bindings.length) return null;

  // Filter out unresolved entity IDs (e.g. "Q12345") that Wikidata returns when a label is missing
  const isLabel = (v: string) => !!v && !v.match(/^Q\d+$/);

  const composers = [...new Set(
    bindings.map((b) => b.composerLabel?.value).filter(isLabel)
  )] as string[];
  const lyricists = [...new Set(
    bindings.map((b) => b.lyricistLabel?.value).filter(isLabel)
  )] as string[];

  return composers.length || lyricists.length ? { composers, lyricists } : null;
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

  const trySearch = async (q: string) => {
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.tracks?.items?.[0] ?? null;
  };

  // Try with artist constraint first, fall back to title-only field search (still fuzzy-matches typos)
  const track =
    (await trySearch(`track:${title} artist:${artist}`)) ??
    (await trySearch(`track:${title}`));
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
    title: track.name as string,
    artist: (track.artists?.[0]?.name ?? "") as string,
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

  console.log("[enrich] input:", { title, artist });

  // MusicBrainz first — its recording titles are clean (no "Remastered", "Radio Edit" etc.)
  const mbResult = await enrichMusicBrainz(title, artist).catch((e) => { console.error("[enrich] MusicBrainz error:", e); return null; });
  console.log("[enrich] MusicBrainz result:", mbResult);

  const canonicalTitle = mbResult?.title ?? title;
  const canonicalArtist = mbResult?.display_artist ?? artist;
  console.log("[enrich] canonical:", { canonicalTitle, canonicalArtist });

  // Feed canonical title/artist into remaining sources in parallel
  const [spotify, secondhandsongs, wikidata, genius] = await Promise.allSettled([
    enrichSpotify(canonicalTitle, canonicalArtist),
    enrichSecondHandSongs(canonicalTitle, canonicalArtist),
    enrichWikidata(canonicalTitle, canonicalArtist),
    enrichGenius(canonicalTitle, canonicalArtist),
  ]);

  const spotifyVal = spotify.status === "fulfilled" ? spotify.value : null;
  const shsVal = secondhandsongs.status === "fulfilled" ? secondhandsongs.value : null;
  const wdVal = wikidata.status === "fulfilled" ? wikidata.value : null;
  const geniusVal = genius.status === "fulfilled" ? genius.value : null;

  if (secondhandsongs.status === "rejected") console.error("[enrich] SHS error:", secondhandsongs.reason);
  if (wikidata.status === "rejected") console.error("[enrich] Wikidata error:", wikidata.reason);
  if (spotify.status === "rejected") console.error("[enrich] Spotify error:", spotify.reason);

  console.log("[enrich] Spotify:", spotifyVal);
  console.log("[enrich] SecondHandSongs:", shsVal);
  console.log("[enrich] Wikidata:", wdVal);

  console.log("─── COMPOSER SOURCES ───────────────────────────────");
  console.log("MusicBrainz composers:", mbResult?.composers ?? "none");
  console.log("SecondHandSongs composers:", shsVal?.composers ?? "none");
  console.log("Wikidata composers:", wdVal?.composers ?? "none");
  console.log("MusicBrainz lyricists:", mbResult?.lyricists ?? "none");
  console.log("SecondHandSongs lyricists:", shsVal?.lyricists ?? "none");
  console.log("Wikidata lyricists:", wdVal?.lyricists ?? "none");
  console.log("────────────────────────────────────────────────────");

  return NextResponse.json({
    musicbrainz: mbResult,
    secondhandsongs: shsVal,
    wikidata: wdVal,
    spotify: spotifyVal,
    genius: geniusVal,
  });
}
