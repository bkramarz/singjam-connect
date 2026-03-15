"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Result = {
  song_id: string;
  title: string;
  display_artist: string | null;
  aka: string[] | null;
  score: number;
};

const LEVELS = [
  { key: "lead", label: "Lead" },
  { key: "support", label: "Support" },
  { key: "follow", label: "Follow" },
  { key: "learn", label: "Learn" },
] as const;

export default function SongSearch({ initialQuery = "" }: { initialQuery?: string }) {
  const supabase = supabaseBrowser();

  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  const [level, setLevel] = useState<(typeof LEVELS)[number]["key"]>("support");
  const [status, setStatus] = useState<string | null>(null);

  const debounceRef = useRef<number | null>(null);

  async function runSearch(query: string) {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    setLoading(true);
    setStatus(null);

    const { data, error } = await supabase.rpc("search_songs", {
      q: trimmed,
      limit_n: 50,
    });

    setLoading(false);

    if (error) {
      console.error("Song search error:", error);
      setStatus("Search failed. Please try again.");
      setResults([]);
      return;
    }

    setResults((data ?? []) as Result[]);
  }

  useEffect(() => {
    // Run immediately on first render if initialQuery exists
    if (initialQuery.trim()) runSearch(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);

    debounceRef.current = window.setTimeout(() => {
      runSearch(q);
    }, 200);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function addSong(songId: string) {
    setStatus(null);

    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (!session) {
      setStatus("Please sign in first.");
      return;
    }

    const { error } = await supabase.from("user_songs").upsert(
      {
        user_id: session.user.id,
        song_id: songId,
        confidence: level,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,song_id" }
    );

    setStatus(error ? error.message : "Added!");
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-zinc-200 p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-sm font-medium">Search</label>
            <input
              className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder='Try: "wagon weel", "i once was lost", "beatls", "cohen", "shlomo carlebach"'
            />
            <div className="mt-1 text-xs text-zinc-500">
              Tip: searching a person name returns songs connected via composer credits or recordings.
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium">Add as</label>
            <select
              className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
              value={level}
              onChange={(e) => setLevel(e.target.value as any)}
            >
              {LEVELS.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-zinc-500">
          {loading ? "Searching…" : q.trim() ? `${results.length} song(s)` : "Type to search"}
        </div>

        {status ? <div className="text-sm text-zinc-700">{status}</div> : null}
      </div>

      {/* Results live ON the page */}
      {q.trim() ? (
        <div className="grid gap-2">
          {results.map((r) => (
            <div key={r.song_id} className="rounded-2xl border border-zinc-200 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {r.title}
                    {r.display_artist ? (
                      <span className="text-zinc-500 font-normal"> — {r.display_artist}</span>
                    ) : null}
                  </div>

                  {r.aka && r.aka.length ? (
                    <div className="text-xs text-zinc-500 truncate">aka: {r.aka.join(" · ")}</div>
                  ) : null}
                </div>

                <button
                  className="shrink-0 rounded-xl border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50"
                  onClick={() => addSong(r.song_id)}
                >
                  Add
                </button>
              </div>
            </div>
          ))}

          {!loading && results.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 p-5 text-sm text-zinc-600">
              No songs found.
              <div className="mt-2 text-xs text-zinc-500">
                Next step: add a “Request a song” button + moderation queue.
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 p-5 text-sm text-zinc-600">
          Start typing to search the catalog.
        </div>
      )}
    </div>
  );
}