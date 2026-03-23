import { supabaseServer } from "@/lib/supabase/server";
import SongSearch from "@/components/SongSearch";

export default async function SongsPage() {
  const supabase = await supabaseServer();

  const { data: { user } } = await supabase.auth.getUser();

  const [songsRes, repertoireRes] = await Promise.all([
    supabase
      .from("songs")
      .select(`
        id, title, slug, display_artist, year_written,
        song_composers(people(name)),
        song_lyricists(people(name)),
        song_recording_artists(year),
        song_productions(productions(name)),
        user_songs(count)
      `)
      .limit(500),
    user
      ? supabase.from("user_songs").select("song_id").eq("user_id", user.id)
      : Promise.resolve({ data: [] }),
  ]);

  const repertoireSongIds = new Set((repertoireRes.data ?? []).map((r: any) => r.song_id));

  const popularSongs = (songsRes.data ?? [])
    .map((s: any) => ({
      song_id: s.id as string,
      title: s.title as string,
      slug: (s.slug ?? null) as string | null,
      display_artist: (s.display_artist ?? null) as string | null,
      productions: ((s.song_productions ?? []) as any[]).map((p: any) => p.productions?.name as string).filter(Boolean) as string[],
      composers: Array.from(new Set([
        ...((s.song_composers ?? []) as any[]).map((c: any) => c.people?.name as string),
        ...((s.song_lyricists ?? []) as any[]).map((c: any) => c.people?.name as string),
      ])).filter(Boolean).sort() as string[],
      year: (() => {
        const firstRecording = ((s.song_recording_artists ?? []) as any[])
          .map((r: any) => r.year as number)
          .filter((y): y is number => typeof y === "number")
          .sort((a, b) => a - b)[0] ?? null;
        const yearWritten = (s as any).year_written as number | null;
        if (yearWritten && firstRecording) return Math.min(yearWritten, firstRecording);
        return yearWritten ?? firstRecording ?? null;
      })(),
      popularity: ((s.user_songs as any[])[0]?.count ?? 0) as number,
    }))
    .filter((s) => !repertoireSongIds.has(s.song_id))
    .sort((a, b) => b.popularity - a.popularity || a.title.localeCompare(b.title))
    .slice(0, 30);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Song Library</h1>
      <p className="text-sm text-zinc-600">
        Search by title, first line, recording artist, or composer. Autocomplete is typo-tolerant.
      </p>
      <SongSearch popularSongs={popularSongs} />
    </div>
  );
}
