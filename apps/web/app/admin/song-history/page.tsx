import type { Metadata } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import { computeSongPlayStats, toJamsForStats, type LinkedSetRow } from "@/lib/songPlayStats";
import SongHistoryTable from "./SongHistoryTable";

export const metadata: Metadata = {
  title: "Song History",
};

export default async function SongHistoryPage() {
  const supabase = await supabaseServer();

  const { data } = await supabase
    .from("sets")
    .select(`
      jams!inner(id, name, starts_at),
      set_songs!inner(
        songs(id, title, slug, display_artist)
      )
    `)
    .eq("jams.visibility", "official")
    .lte("jams.starts_at", new Date().toISOString())
    .eq("set_songs.played", true);

  const stats = computeSongPlayStats(toJamsForStats((data ?? []) as unknown as LinkedSetRow[]));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Song History</h1>
          <p className="text-sm text-slate-500">
            How often each song has been played at official SingJam events.
          </p>
        </div>
        <div className="w-fit rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{stats.length}</span>{" "}
          unique {stats.length === 1 ? "song" : "songs"} played
        </div>
      </div>

      <SongHistoryTable stats={stats} />
    </div>
  );
}
