import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";
import DeleteSongButton from "./DeleteSongButton";

export default async function AdminSongsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await supabaseServer();

  let query = supabase
    .from("songs")
    .select(`
      id, title, slug, display_artist,
      first_line, hook, genius_url, chord_chart_url, tonality, meter,
      song_composers(people(name)),
      song_lyricists(people(name)),
      song_recording_artists(year),
      song_genres(genre_id),
      song_languages(language_id),
      user_songs(count)
    `)
    .order("title");

  if (q) {
    query = query.ilike("title", `%${q}%`);
  }

  const { data: songs } = await query.limit(200);

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

      <form method="GET">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by title…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
        />
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium text-slate-500">
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Songwriters</th>
              <th className="px-4 py-3">Artist(s)</th>
              <th className="px-4 py-3">First recorded</th>
              <th className="px-4 py-3">SingJam popularity</th>
              <th className="px-4 py-3">Missing</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(songs ?? []).map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-medium text-slate-900">{s.title}</td>
                <td className="px-4 py-2.5 text-slate-500">
                  {(() => {
                    const names = new Set<string>([
                      ...(s.song_composers ?? []).map((c: any) => c.people?.name).filter(Boolean),
                      ...(s.song_lyricists ?? []).map((l: any) => l.people?.name).filter(Boolean),
                    ]);
                    const sorted = [...names].sort();
                    return sorted.length ? sorted.join(", ") : "—";
                  })()}
                </td>
                <td className="px-4 py-2.5 text-slate-500">
                  {s.display_artist ? s.display_artist.replace(/ & /g, " | ") : "—"}
                </td>
                <td className="px-4 py-2.5 text-slate-500">{
                  (() => {
                    const years = (s.song_recording_artists ?? [])
                      .map((r: any) => r.year)
                      .filter((y: any): y is number => typeof y === "number");
                    return years.length ? Math.min(...years) : "—";
                  })()
                }</td>
                <td className="px-4 py-2.5 text-slate-500">
                  {(s.user_songs as any)?.[0]?.count ?? 0}
                </td>
                <td className="px-4 py-2.5">
                  {(() => {
                    const missing: string[] = [];
                    if (!(s.song_composers ?? []).length) missing.push("composer");
                    if (!(s.song_lyricists ?? []).length) missing.push("lyricist");
                    if (!s.display_artist) missing.push("artist");
                    if (!(s.song_recording_artists ?? []).length) missing.push("recording");
                    if (!s.first_line) missing.push("first line");
                    if (!s.hook) missing.push("hook");
                    if (!s.genius_url) missing.push("genius");
                    if (!s.tonality) missing.push("tonality");
                    if (!s.meter) missing.push("meter");
                    if (!(s.song_genres ?? []).length) missing.push("genre");
                    if (!(s.song_languages ?? []).length) missing.push("language");
                    if (!missing.length) return <span className="text-xs text-slate-300">✓</span>;
                    return (
                      <div className="flex flex-wrap gap-1">
                        {missing.map((m) => (
                          <span key={m} className="rounded-full bg-red-50 border border-red-200 px-1.5 py-0.5 text-xs text-red-500">
                            {m}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/admin/songs/${(s as any).slug ?? s.id}`}
                      className="text-amber-600 hover:text-amber-500"
                    >
                      Edit
                    </Link>
                    <DeleteSongButton id={s.id} />
                  </div>
                </td>
              </tr>
            ))}
            {!songs?.length && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  {q ? "No songs match that search." : "No songs yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
