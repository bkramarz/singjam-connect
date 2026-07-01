import type { Metadata } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import { computeSongPlayStats, type JamForStats } from "@/lib/songPlayStats";
import SongHistoryTable from "./SongHistoryTable";

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

      <SongHistoryTable stats={stats} />
    </div>
  );
}
