import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseServer } from "@/lib/supabase/server";

const SYSTEM_PROMPT = `You are a music research assistant helping to enrich a song database for SingJam, a platform for musicians.

Given the current data for a song, research and suggest corrections or additions for these fields:
- year_written: The year the song was composed/written (not recorded)
- first_line: The very first sung lyric line of the song (exclude section headers like [Verse 1])
- hook: The most recognisable lyric phrase, typically from the chorus
- composers: Full list of people who wrote the music
- lyricists: Full list of people who wrote the words (often identical to composers)
- primary_recording_year: Year of the most well-known or original recording

Rules:
- Only suggest values you are confident about. If unsure, return null for scalar fields or an empty array for lists.
- For first_line and hook, provide verbatim lyrics, not paraphrases.
- Use full canonical names for composers and lyricists (e.g. "Bob Dylan", not "Robert Zimmerman").
- For traditional or folk songs, use ["Traditional"] for both composers and lyricists.
- Return the full suggested list even if some names are already correct.
- Set confidence to "high" only when you are certain. Use "medium" or "low" otherwise.
- Use the notes field to flag anything important: disputed credits, alternate versions, etc.

Respond with valid JSON only, matching this exact schema:
{
  "year_written": number | null,
  "first_line": string | null,
  "hook": string | null,
  "composers": string[],
  "lyricists": string[],
  "primary_recording_year": number | null,
  "confidence": "high" | "medium" | "low",
  "notes": string | null
}`;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await supabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const { id: songId } = await params;

  const { data: song } = await supabase
    .from("songs")
    .select(`
      id, title, display_artist, year, year_written, slug, first_line, hook, notes,
      song_composers ( people ( name ) ),
      song_lyricists ( people ( name ) ),
      song_recording_artists ( year, position, artists ( name ) ),
      song_genres ( genres ( name ) ),
      song_themes ( themes ( name ) ),
      song_productions ( productions ( name ) )
    `)
    .eq("id", songId)
    .single();

  if (!song) return NextResponse.json({ error: "Song not found" }, { status: 404 });

  const composers = (song.song_composers as any[])?.map((c) => c.people?.name).filter(Boolean) ?? [];
  const lyricists = (song.song_lyricists as any[])?.map((l) => l.people?.name).filter(Boolean) ?? [];
  const recordings = ((song.song_recording_artists as any[]) ?? [])
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
    .map((r) => ({ artist: r.artists?.name, year: r.year }));
  const genres = (song.song_genres as any[])?.map((g) => g.genres?.name).filter(Boolean) ?? [];
  const themes = (song.song_themes as any[])?.map((t) => t.themes?.name).filter(Boolean) ?? [];
  const productions = (song.song_productions as any[])?.map((p) => p.productions?.name).filter(Boolean) ?? [];

  const context = JSON.stringify({
    title: song.title,
    display_artist: song.display_artist,
    year_written: song.year_written,
    year: song.year,
    first_line: song.first_line,
    hook: song.hook,
    notes: song.notes,
    composers,
    lyricists,
    recording_artists: recordings,
    genres,
    themes,
    productions,
  }, null, 2);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Current song data:\n\n${context}\n\nPlease research this song and return your suggested values.` },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let suggestions;
  try {
    suggestions = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
  }

  return NextResponse.json({ suggestions });
}
