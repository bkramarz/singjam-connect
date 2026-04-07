import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

const LANG_CODE_MAP: Record<string, string> = {
  eng: "English", fra: "French", spa: "Spanish", deu: "German",
  ita: "Italian", por: "Portuguese", rus: "Russian", jpn: "Japanese",
  zho: "Chinese", kor: "Korean", nld: "Dutch", pol: "Polish",
  swe: "Swedish", nor: "Norwegian", fin: "Finnish", heb: "Hebrew",
  ara: "Arabic", hin: "Hindi", lat: "Latin", cat: "Catalan",
  tur: "Turkish", vie: "Vietnamese", tha: "Thai", ind: "Indonesian",
};

function generateSlug(title: string, composerNames: string[]): string {
  return [title, ...composerNames]
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function normalizeName(name: string): string {
  return /^\[traditional\]$/i.test(name) ? "Traditional" : name;
}

async function findOrCreate(
  db: ReturnType<typeof admin>,
  table: "people" | "artists",
  name: string
): Promise<string | null> {
  const canonical = normalizeName(name);
  const { data: found } = await db.from(table).select("id").ilike("name", canonical).maybeSingle();
  if (found) return found.id;
  const { data: created } = await db.from(table).insert({ name: canonical }).select("id").single();
  return created?.id ?? null;
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, artist } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const db = admin();

  // Duplicate check
  const { data: existing } = await db
    .from("songs")
    .select("id, slug")
    .ilike("title", title.trim())
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "This song is already in our library.", slug: existing.slug }, { status: 409 });
  }

  // Enrich
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const enrichRes = await fetch(
    `${baseUrl}/api/enrich?title=${encodeURIComponent(title.trim())}&artist=${encodeURIComponent(artist?.trim() ?? "")}&mode=import`
  );
  const enrichData = enrichRes.ok ? await enrichRes.json() : {};

  const mb = enrichData.musicbrainz;
  const genius = enrichData.genius;
  const spotifyGenres: string[] = enrichData.spotify?.genres ?? [];
  const lastfmTags: string[] = enrichData.lastfm?.tags ?? [];

  const finalTitle: string = mb?.title ?? title.trim();
  const composerNames: string[] = mb?.composers ?? [];
  const lyricistNames: string[] = mb?.lyricists ?? [];
  const primaryYear: number | null = mb?.year ?? null;
  const langCodes: string[] = mb?.languages ?? [];
  const primaryArtistName: string | null = mb?.display_artist ?? artist?.trim() ?? null;

  // Ensure slug is unique
  let slug = generateSlug(finalTitle, composerNames);
  const { data: slugConflict } = await db.from("songs").select("id").eq("slug", slug).maybeSingle();
  if (slugConflict) slug = `${slug}-${Date.now()}`;

  // Insert song
  const { data: song, error: songErr } = await db
    .from("songs")
    .insert({
      title: finalTitle,
      display_artist: primaryArtistName || null,
      slug,
      genius_url: genius?.lyrics_url ?? null,
      needs_review: true,
      submitted_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .select("id, slug")
    .single();

  if (songErr || !song) {
    return NextResponse.json({ error: songErr?.message ?? "Failed to create song" }, { status: 500 });
  }

  // Recording artist
  if (primaryArtistName) {
    const artistId = await findOrCreate(db, "artists", primaryArtistName);
    if (artistId) {
      await db.from("song_recording_artists").insert({ song_id: song.id, artist_id: artistId, year: primaryYear, position: 0 });
    }
  }

  // Composers & lyricists
  const composerIds = (await Promise.all(composerNames.map((n) => findOrCreate(db, "people", n)))).filter(Boolean) as string[];
  const lyricistIds = (await Promise.all(lyricistNames.map((n) => findOrCreate(db, "people", n)))).filter(Boolean) as string[];
  if (composerIds.length) await db.from("song_composers").insert(composerIds.map((id) => ({ song_id: song.id, person_id: id })));
  if (lyricistIds.length) await db.from("song_lyricists").insert(lyricistIds.map((id) => ({ song_id: song.id, person_id: id })));

  // Genres & languages
  const [{ data: allGenres }, { data: allLanguages }] = await Promise.all([
    db.from("genres").select("id, name"),
    db.from("languages").select("id, name"),
  ]);

  const allTagNames = [...new Set([...spotifyGenres, ...lastfmTags].map((g) => g.toLowerCase()))];
  const matchedGenreIds = (allGenres ?? []).filter((g: any) => allTagNames.includes(g.name.toLowerCase())).map((g: any) => g.id);
  if (matchedGenreIds.length) await db.from("song_genres").insert(matchedGenreIds.map((id: string) => ({ song_id: song.id, genre_id: id })));

  const langIds = [...new Set(
    langCodes
      .map((code) => {
        const name = LANG_CODE_MAP[code.toLowerCase()];
        return name ? (allLanguages ?? []).find((l: any) => l.name.toLowerCase() === name.toLowerCase())?.id : null;
      })
      .filter((id): id is string => !!id)
  )];
  if (langIds.length) await db.from("song_languages").insert(langIds.map((id) => ({ song_id: song.id, language_id: id })));

  return NextResponse.json({ slug: song.slug });
}
