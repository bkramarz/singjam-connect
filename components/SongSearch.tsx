"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";

type Result = {
  song_id: string;
  title: string;
  display_artist: string | null;
  aka: string[] | null;
  score: number;
  composers: string[];
  year: number | null;
  slug: string | null;
};

const LEVELS = [
  { key: "lead", label: "Lead" },
  { key: "support", label: "Support" },
  { key: "follow", label: "Follow" },
  { key: "learn", label: "Learn" },
] as const;

export default function SongSearch({ initialQuery = "" }: { initialQuery?: string }) {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  const [level, setLevel] = useState<(typeof LEVELS)[number]["key"]>("support");
  const [status, setStatus] = useState<string | null>(null);

  // Map of song_id → confidence for songs already in repertoire
  const [repertoire, setRepertoire] = useState<Map<string, string>>(new Map());

  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      supabase
        .from("user_songs")
        .select("song_id, confidence")
        .eq("user_id", data.session.user.id)
        .then(({ data: rows }) => {
          if (!rows) return;
          setRepertoire(new Map(rows.map((r) => [r.song_id, r.confidence ?? ""])));
        });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    const songs = (data ?? []) as Omit<Result, "composers">[];
    if (!songs.length) { setResults([]); return; }

    const { data: songData } = await supabase
      .from("songs")
      .select("id, year, slug, song_composers(people(name))")
      .in("id", songs.map((s) => s.song_id));

    const byId: Record<string, { composers: string[]; year: number | null; slug: string | null }> = {};
    for (const row of (songData ?? []) as any[]) {
      byId[row.id] = {
        year: row.year ?? null,
        slug: row.slug ?? null,
        composers: (row.song_composers ?? []).map((c: any) => c.people?.name).filter(Boolean).sort(),
      };
    }

    setResults(songs.map((s) => ({ ...s, ...byId[s.song_id] ?? { composers: [], year: null, slug: null } })));
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
      router.push("/auth");
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

    if (error) {
      setStatus(error.message);
    } else {
      setRepertoire((prev) => new Map(prev).set(songId, level));
      setStatus(null);
    }
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
          {results.map((r) => {
            const inRepertoire = repertoire.has(r.song_id);
            const confidence = repertoire.get(r.song_id);
            const confidenceLabel = LEVELS.find((l) => l.key === confidence)?.label ?? confidence;
            return (
              <div key={r.song_id} className="rounded-2xl border border-zinc-200 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {r.title}
                      {r.composers.length > 0 && (
                        <span className="ml-1 font-normal text-zinc-400">
                          ({r.composers.map((name) => {
                            const parts = name.trim().split(" ");
                            return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(" ")}` : name;
                          }).join(", ")})
                        </span>
                      )}
                      {r.display_artist ? (
                        <span className="text-zinc-500 font-normal"> — {r.display_artist}</span>
                      ) : null}
                      {r.year && (
                        <span className="ml-1 font-normal text-zinc-400">({r.year})</span>
                      )}
                    </div>

                    {r.aka && r.aka.length ? (
                      <div className="text-xs text-zinc-500 truncate">aka: {r.aka.join(" · ")}</div>
                    ) : null}

                    {inRepertoire && (
                      <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-700">
                        ✓ In your repertoire{confidenceLabel ? ` · ${confidenceLabel}` : ""}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <Link
                      href={`/songs/${r.slug ?? r.song_id}`}
                      className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50"
                    >
                      View
                    </Link>
                    <button
                      className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50"
                      onClick={() => addSong(r.song_id)}
                    >
                      {inRepertoire ? "Update" : "Add"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

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