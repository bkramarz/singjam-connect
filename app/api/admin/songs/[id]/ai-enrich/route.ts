import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseServer } from "@/lib/supabase/server";

const VALID_TONALITIES = [
  "Major", "Minor", "Dorian", "Phrygian", "Lydian", "Mixolydian",
  "Aeolian", "Locrian", "Harmonic Minor", "Melodic Minor",
  "Pentatonic", "Blues", "Whole Tone", "Chromatic", "Modal",
];

const VALID_METERS = ["4", "3", "5", "7", "9", "11", "Free", "Irregular"];

const VALID_GENRES = [
  "Acoustic", "Afrobeats", "Afropop", "Alternative", "Ambient", "Americana", "Art Rock",
  "Bluegrass", "Blues", "Bossa Nova", "Cabaret", "Cajun", "Celtic", "Chanson", "Children's",
  "Christian", "Classical", "Contemporary Christian", "Country", "Country Rock", "Dance",
  "Disco", "Doo-Wop", "Dream Pop", "Drum and Bass", "Electronic", "Emo", "Experimental",
  "Flamenco", "Folk", "Folk Rock", "Funk", "Gospel", "Glam Rock", "Grunge", "Hard Rock",
  "Heavy Metal", "Hip-Hop/Rap", "Holiday", "House", "Hymns", "Indie", "Jazz", "Klezmer",
  "Latin", "Metal", "Motown", "Musical Theatre", "New Age", "New Wave", "Opera",
  "Outlaw Country", "Pop", "Post-Punk", "Post-Rock", "Progressive Rock", "Psychedelic Rock",
  "Punk", "R&B", "Reggae", "Rockabilly", "Rock", "Roots Rock", "Salsa", "Shanties",
  "Shoegaze", "Singer-Songwriter", "Ska", "Soul", "Spiritual", "Surf Rock", "Synthpop",
  "Tango", "Techno", "Traditional", "Trance", "Trap", "Western Swing", "Work Songs",
  "World", "Worship", "Zydeco",
];

const VALID_THEMES = [
  "Addiction", "Aging", "Betrayal", "Celebration", "Childhood", "City Life", "Coming of Age",
  "Courage", "Dancing", "Death", "Drinking", "Dreams", "Exile", "Faith", "Family", "Fantasy",
  "Forgiveness", "Freedom", "Friendship", "History", "Home", "Hope", "Humor", "Identity",
  "Immigration", "Joy", "Justice", "Labor", "Longing", "Loss", "Love", "Memory", "Music",
  "Mythology", "Nature", "Nostalgia", "Parenthood", "Peace", "Politics", "Poverty", "Pride",
  "Race", "Rebellion", "Religion", "Romance", "Rural Life", "Satire", "Sea", "Seasons",
  "Shame", "Spirituality", "Storytelling", "Struggle", "Time", "Travel", "Unity", "Wandering",
  "War", "Wealth", "Work", "Youth",
];

const VALID_CULTURES = [
  "American", "Appalachian", "Arab", "Argentine", "Australian", "Belgian", "Brazilian", "Cajun", "Cambodian", "Chilean", "Chinese",
  "Colombian", "Creole", "Cuban", "Czech", "Danish", "Dutch", "East African", "Egyptian", "English",
  "Ethiopian", "Filipino", "Finnish", "First Nations/Native American", "French", "German", "Ghanaian", "Greek",
  "Haitian", "Hawaiian", "Hungarian", "Indian", "Indonesian", "Irish", "Israeli", "Italian",
  "Jamaican", "Japanese", "Jewish", "Kenyan", "Korean", "Latin American", "Māori", "Mexican",
  "Nepali", "Nigerian", "Norwegian", "Pakistani", "Peruvian", "Polish",
  "Portuguese", "Puerto Rican", "Romanian", "Romani", "Russian", "Scandinavian", "Scottish",
  "South African", "Spanish", "Sri Lankan", "Swedish", "Swiss", "Tex-Mex", "Thai", "Trinidadian",
  "Turkish", "Ukrainian", "Venezuelan", "Vietnamese", "Welsh", "West African", "Yoruba", "Zulu",
  "Bahá'í", "Buddhist", "Catholic", "Christian", "Confucian", "Eastern Orthodox", "Hindu",
  "Islamic", "Jewish", "Mormon/LDS", "Pagan", "Protestant", "Rastafarian", "Shinto",
  "Sikh", "Sufi", "Taoist", "Zoroastrian",
];

const SYSTEM_PROMPT = `You are a music research assistant helping to enrich a song database for SingJam, a platform for musicians.

Given the current data for a song, research and suggest corrections or additions for these fields:
- year_written: The year the song was composed/written (not recorded)
- first_line: The very first sung lyric line of the song (exclude section headers like [Verse 1])
- hook: The most recognisable lyric phrase, typically from the chorus
- composers: Full list of people who wrote the music
- lyricists: Full list of people who wrote the words (often identical to composers)
- primary_recording_year: Year of the most well-known or original recording
- tonality: The key mode of the song. Must be one of: ${VALID_TONALITIES.join(", ")}
- meter: The time signature numerator. Must be one of: ${VALID_METERS.join(", ")}
- vibe: Overall energy feel — must be "Banger", "Ballad", or null
- genres: Up to 3 genres. Must each be from: ${VALID_GENRES.join(", ")}
- themes: Up to 3 lyrical/emotional themes. Must each be from: ${VALID_THEMES.join(", ")}
- cultures: Cultural origins or associations (if any). Must each be from: ${VALID_CULTURES.join(", ")}
- music_culture: For traditional songs, the cultural tradition the melody comes from (e.g. "Irish", "Scottish"). Single value or null. Must be from the cultures list.
- lyric_culture: For traditional songs, the cultural tradition the lyrics come from. Often identical to music_culture but can differ. Single value or null. Must be from the cultures list.
- languages: Languages the song is sung in, as plain English names (e.g. "English", "French")
- notes: A concise factual paragraph about the song's history, origin, or cultural significance. Include disputed credits, notable recordings, or anything a musician would find useful. Null if nothing meaningful to add.
- alternate_titles: Other titles the song is commonly known by (e.g. subtitle variants, translated titles, common misspellings). Do not repeat titles already in the current alternate_titles list.
- additional_recordings: Up to 2 other significant recordings of this song not already in the recording_artists list. Each entry must have "artist" (canonical artist name) and "year" (recording year — required; only omit if completely unverifiable). Focus on the most historically or culturally notable versions.

Rules:
- Only suggest values you are confident about. If unsure, return null for scalar fields or an empty array for lists.
- For first_line and hook, provide verbatim lyrics, not paraphrases.
- Use full canonical names for composers and lyricists (e.g. "Bob Dylan", not "Robert Zimmerman").
- For traditional or folk songs, use ["Traditional"] for both composers and lyricists.
- Return the full suggested list even if some names are already correct.
- Only use values from the provided lists for tonality, meter, vibe, genres, themes, and cultures. Do not invent new values.
- Set confidence to "high" only when you are certain. Use "medium" or "low" otherwise.

Respond with valid JSON only, matching this exact schema:
{
  "year_written": number | null,
  "first_line": string | null,
  "hook": string | null,
  "composers": string[],
  "lyricists": string[],
  "primary_recording_year": number | null,
  "tonality": string | null,
  "meter": string | null,
  "vibe": "Banger" | "Ballad" | null,
  "genres": string[],
  "themes": string[],
  "cultures": string[],
  "music_culture": string | null,
  "lyric_culture": string | null,
  "languages": string[],
  "notes": string | null,
  "alternate_titles": string[],
  "additional_recordings": { "artist": string, "year": number | null }[],
  "confidence": "high" | "medium" | "low"
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
      song_productions ( productions ( name ) ),
      song_cultures ( context, cultures ( name ) ),
      song_alternate_titles ( title )
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
  const musicCulture = (song.song_cultures as any[])?.find((x) => x.context === "music")?.cultures?.name ?? null;
  const lyricCulture = (song.song_cultures as any[])?.find((x) => x.context === "lyrics")?.cultures?.name ?? null;
  const alternateTitles = (song.song_alternate_titles as any[])?.map((t) => t.title).filter(Boolean) ?? [];

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
    music_culture: musicCulture,
    lyric_culture: lyricCulture,
    alternate_titles: alternateTitles,
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
