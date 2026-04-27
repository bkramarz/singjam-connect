"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type SharedSong = {
  song_id: string;
  title: string;
  display_artist: string | null;
  viewer_leads: boolean;
  who_else: string[];
  who_else_leads: string[];
};

export default function JamSharedSongs({ jamId }: { jamId: string }) {
  const [songs, setSongs] = useState<SharedSong[] | null>(null);
  const supabase = supabaseBrowser();

  useEffect(() => {
    supabase.rpc("jam_shared_songs", { jam_id_param: jamId }).then(({ data }) => {
      setSongs((data as SharedSong[] | null) ?? []);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jamId]);

  if (!songs || songs.length === 0) return null;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
      <h2 className="text-base font-semibold">Songs you share</h2>
      <ul className="divide-y divide-zinc-100">
        {songs.map((s) => {
          const leadsSet = new Set(s.who_else_leads);
          const nameParts = [
            s.viewer_leads
              ? <strong key="you">You</strong>
              : <span key="you">You</span>,
            ...s.who_else.map((name) =>
              leadsSet.has(name)
                ? <strong key={name}>{name}</strong>
                : <span key={name}>{name}</span>
            ),
          ];
          const nameNodes = nameParts.flatMap((node, i) =>
            i < nameParts.length - 1 ? [node, ", "] : [node]
          );
          return (
            <li key={s.song_id} className="flex items-baseline justify-between gap-4 py-2.5">
              <div className="min-w-0">
                <span className="text-sm font-medium text-zinc-900">{s.title}</span>
                {s.display_artist && (
                  <span className="ml-1.5 text-xs text-zinc-400">{s.display_artist}</span>
                )}
              </div>
              <span className="shrink-0 text-xs text-zinc-500">({nameNodes})</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
