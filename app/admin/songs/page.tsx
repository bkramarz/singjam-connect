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
      id, title, display_artist, energy, difficulty, popularity,
      song_composers(people(name)),
      song_lyricists(people(name)),
      song_recording_artists(year)
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
              <th className="px-4 py-3">Artist</th>
              <th className="px-4 py-3">First recorded</th>
              <th className="px-4 py-3">E</th>
              <th className="px-4 py-3">D</th>
              <th className="px-4 py-3">Pop</th>
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
                <td className="px-4 py-2.5 text-slate-500">{s.display_artist ?? "—"}</td>
                <td className="px-4 py-2.5 text-slate-500">{
                  (() => {
                    const years = (s.song_recording_artists ?? [])
                      .map((r: any) => r.year)
                      .filter((y: any): y is number => typeof y === "number");
                    return years.length ? Math.min(...years) : "—";
                  })()
                }</td>
                <td className="px-4 py-2.5 text-slate-500">{s.energy ?? "—"}</td>
                <td className="px-4 py-2.5 text-slate-500">{s.difficulty ?? "—"}</td>
                <td className="px-4 py-2.5 text-slate-500">{s.popularity ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/admin/songs/${s.id}`}
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
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
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
