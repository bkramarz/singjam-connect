"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type SharedSong = {
  song_id: string;
  slug: string;
  title: string;
  display_artist: string | null;
  viewer_has: boolean;
  viewer_leads: boolean;
  who_else: string[];
  who_else_leads: string[];
  in_set: boolean;
};

type SortMode = "popular" | "alpha" | "leader";

function displayedSongs(songs: SharedSong[], mode: SortMode, selectedLeaders: Set<string>): SharedSong[] {
  if (mode === "leader" && selectedLeaders.size > 0) {
    return [...songs]
      .filter((s) =>
        [...selectedLeaders].every((name) =>
          name === "You" ? s.viewer_leads : s.who_else_leads.includes(name)
        )
      )
      .sort((a, b) => a.title.localeCompare(b.title));
  }
  return [...songs].sort((a, b) => {
    if (mode === "alpha") return a.title.localeCompare(b.title);
    const aTotal = a.who_else.length + (a.viewer_has ? 1 : 0);
    const bTotal = b.who_else.length + (b.viewer_has ? 1 : 0);
    return bTotal !== aTotal ? bTotal - aTotal : a.title.localeCompare(b.title);
  });
}

export default function JamSharedSongs({ jamId }: { jamId: string }) {
  const [songs, setSongs] = useState<SharedSong[] | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("popular");
  const [selectedLeaders, setSelectedLeaders] = useState<Set<string>>(new Set());
  const [linkedSetId, setLinkedSetId] = useState<string | null | undefined>(undefined);
  const [inSetSongIds, setInSetSongIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const supabase = supabaseBrowser();

  useEffect(() => {
    supabase.rpc("jam_shared_songs", { jam_id_param: jamId }).then(({ data }) => {
      const list = (data as SharedSong[] | null) ?? [];
      setSongs(list);
      setInSetSongIds(new Set(list.filter((s) => s.in_set).map((s) => s.song_id)));
    });

    fetch(`/api/jam/${jamId}/set`)
      .then((r) => r.json())
      .then(({ set }) => setLinkedSetId(set ? set.id : null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jamId]);

  async function addToSet(songId: string) {
    if (!linkedSetId || addingId) return;
    setInSetSongIds((prev) => new Set(prev).add(songId));
    setAddingId(songId);
    const res = await fetch(`/api/sets/${linkedSetId}/songs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ songId }),
    });
    setAddingId(null);
    if (!res.ok && res.status !== 409) {
      setInSetSongIds((prev) => { const next = new Set(prev); next.delete(songId); return next; });
    }
  }

  if (!songs || songs.length === 0) return null;

  const leaderNames = Array.from(
    new Set(songs.flatMap((s) => [...(s.viewer_leads ? ["You"] : []), ...s.who_else_leads]))
  ).sort((a, b) => (a === "You" ? -1 : b === "You" ? 1 : a.localeCompare(b)));

  const sorted = displayedSongs(songs, sortMode, selectedLeaders);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold">Songs you share</h2>
        <div className="flex items-center self-start gap-0.5 rounded-lg bg-zinc-100 p-0.5 text-xs font-medium">
          {(["popular", "alpha", "leader"] as SortMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setSortMode(mode);
                if (mode !== "leader") setSelectedLeaders(new Set());
              }}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                sortMode === mode
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {mode === "popular" ? "Popular" : mode === "alpha" ? "A–Z" : "Leader"}
            </button>
          ))}
        </div>
      </div>

      {sortMode === "leader" && leaderNames.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {leaderNames.map((name) => (
            <button
              key={name}
              onClick={() =>
                setSelectedLeaders((prev) => {
                  const next = new Set(prev);
                  next.has(name) ? next.delete(name) : next.add(name);
                  return next;
                })
              }
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selectedLeaders.has(name)
                  ? "bg-amber-500 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <ul className="divide-y divide-zinc-100 max-h-96 overflow-y-auto">
        {sorted.map((s) => {
          const leadsSet = new Set(s.who_else_leads);
          const nameParts = [
            ...(s.viewer_has
              ? [s.viewer_leads ? <strong key="you">You</strong> : <span key="you">You</span>]
              : []),
            ...s.who_else.map((name) =>
              leadsSet.has(name)
                ? <strong key={name}>{name}</strong>
                : <span key={name}>{name}</span>
            ),
          ];
          const nameNodes = nameParts.flatMap((node, i) =>
            i < nameParts.length - 1 ? [node, ", "] : [node]
          );
          const inSet = inSetSongIds.has(s.song_id);
          const isAdding = addingId === s.song_id;
          return (
            <li key={s.song_id} className="flex items-start justify-between gap-3 py-2.5">
              <div className={`min-w-0 flex-1 ${inSet ? "opacity-40" : ""}`}>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  {s.slug ? (
                    <a
                      href={`/songs/${s.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-zinc-900 hover:underline"
                    >
                      {s.title}
                    </a>
                  ) : (
                    <span className="text-sm font-medium text-zinc-900">{s.title}</span>
                  )}
                  {s.display_artist && (
                    <span className="text-xs text-zinc-400">{s.display_artist}</span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">({nameNodes})</p>
              </div>
              {linkedSetId && (
                <button
                  onClick={() => addToSet(s.song_id)}
                  disabled={inSet || isAdding}
                  title={inSet ? "Already in set" : "Add to set list"}
                  className={`mt-0.5 flex items-center justify-center w-5 h-5 rounded-full border transition-colors shrink-0 ${
                    inSet
                      ? "border-green-300 text-green-500"
                      : "border-zinc-200 text-zinc-400 hover:border-zinc-400 hover:text-zinc-700"
                  } disabled:cursor-default`}
                >
                  {inSet ? (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  )}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
