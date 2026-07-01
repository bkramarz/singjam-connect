import type { Metadata } from "next";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { computeSongPlayStats, type JamForStats } from "@/lib/songPlayStats";

export const metadata: Metadata = {
  title: "Song History",
};

export default async function SongHistoryPage() {
  const supabase = await supabaseServer();

  const { data } = await supabase
    .from("jams")
    .select(`
      id, name, starts_at,
      sets(
        set_songs(
          songs(id, title, slug, display_artist)
        )
      )
    `)
    .eq("visibility", "official")
    .lte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: false });

  const stats = computeSongPlayStats((data ?? []) as unknown as JamForStats[]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Song History</h1>
        <p className="text-sm text-slate-500">
          How often each song has been played at official SingJam events.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium text-slate-500">
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Artist</th>
              <th className="px-4 py-3">Times played</th>
              <th className="px-4 py-3">Last played</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {stats.map((s) => (
              <tr key={s.songId} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-medium">
                  <Link
                    href={`/songs/${s.slug ?? s.songId}`}
                    className="text-slate-900 hover:text-amber-600 hover:underline"
                  >
                    {s.title}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-slate-500">{s.displayArtist ?? "—"}</td>
                <td className="px-4 py-2.5 text-slate-500">{s.playCount}</td>
                <td className="px-4 py-2.5 text-slate-500">
                  {new Date(s.lastPlayedAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                  {s.lastJamName ? ` — ${s.lastJamName}` : ""}
                </td>
              </tr>
            ))}
            {!stats.length && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  No songs have been played at official events yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
