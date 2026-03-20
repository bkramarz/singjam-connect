import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";
import AdminSongsTable from "./AdminSongsTable";

export default async function AdminSongsPage() {
  const supabase = await supabaseServer();

  const { data: songs } = await supabase
    .from("songs")
    .select(`
      id, title, slug, display_artist,
      first_line, hook, genius_url, chord_chart_url, tonality, meter, vibe, year_written,
      song_composers(people(name)),
      song_lyricists(people(name)),
      song_recording_artists(year),
      song_genres(genre_id),
      song_languages(language_id),
      user_songs(count)
    `)
    .order("title")
    .limit(500);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Songs</h1>
        <Link
          href="/admin/songs/new"
          className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-400"
        >
          + Add song
        </Link>
      </div>

      <AdminSongsTable songs={(songs ?? []) as any} />
    </div>
  );
}
