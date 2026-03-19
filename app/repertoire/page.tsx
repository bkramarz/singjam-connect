"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

const CONFIDENCE_LEVELS = [
  { key: "lead", label: "Lead" },
  { key: "support", label: "Support" },
  { key: "follow", label: "Follow" },
  { key: "learn", label: "Learn" },
] as const;

type ConfidenceKey = (typeof CONFIDENCE_LEVELS)[number]["key"];

type Item = {
  song_id: string;
  slug: string | null;
  confidence: string | null;
  updated_at: string | null;
  title: string;
  display_artist: string | null;
  composers: string[];
};

type UserSongRow = {
  song_id: string;
  confidence: string | null;
  updated_at: string | null;
  songs: {
    title: string;
    slug: string | null;
    display_artist: string | null;
    song_composers: { people: { name: string } | null }[];
    song_lyricists: { people: { name: string } | null }[];
  } | null;
};

export default function RepertoirePage() {
  // IMPORTANT: keep Supabase client stable across renders
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();

  const inFlight = useRef(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [confidenceFilter, setConfidenceFilter] = useState<string>("all");

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Avoid StrictMode double-fetch + accidental re-entry
      if (inFlight.current) return;
      inFlight.current = true;

      try {
        setLoading(true);

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!data.session) {
          setLoading(false);
          router.push("/auth");
          return;
        }

        const uid = data.session.user.id;
        setUserId(uid);

        const { data: rows, error } = await supabase
          .from("user_songs")
          .select(
            `
            song_id,
            confidence,
            updated_at,
            songs (
              title,
              slug,
              display_artist,
              song_composers ( people ( name ) ),
              song_lyricists ( people ( name ) )
            )
          `
          )
          .eq("user_id", uid)
          .order("updated_at", { ascending: false });

        if (cancelled) return;

        if (error) {
          console.error("Repertoire load error:", error);
          setErrorMsg("Failed to load repertoire. Please try again.");
          setItems([]);
          return;
        }

        const typed = (rows ?? []) as unknown as UserSongRow[];
        const flattened: Item[] = typed
          .filter((r) => r.songs)
          .map((r) => {
            const names = new Set<string>([
              ...(r.songs!.song_composers ?? []).map((c) => c.people?.name).filter(Boolean) as string[],
              ...(r.songs!.song_lyricists ?? []).map((l) => l.people?.name).filter(Boolean) as string[],
            ]);
            return {
              song_id: r.song_id,
              slug: r.songs!.slug ?? null,
              confidence: r.confidence,
              updated_at: r.updated_at,
              title: r.songs!.title,
              display_artist: r.songs!.display_artist,
              composers: [...names].sort(),
            };
          });

        setItems(flattened);
      } catch (e: any) {
        console.error("Repertoire load exception:", e);
        setErrorMsg("Something went wrong. Please try again.");
        setItems([]);
      } finally {
        // release lock first so it can't get stuck true
        inFlight.current = false;

        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
    // NOTE: supabase is memoized; we only depend on router
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return items.filter((it) => {
      const matchesConfidence =
        confidenceFilter === "all" ? true : (it.confidence ?? "") === confidenceFilter;

      if (!matchesConfidence) return false;
      if (!q) return true;

      const hay = [it.title, it.display_artist ?? ""]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [items, query, confidenceFilter]);

  const confidenceLabel = (key: string | null) => {
    if (!key) return "Unrated";
    return CONFIDENCE_LEVELS.find((l) => l.key === key)?.label ?? key;
  };

  const updateConfidence = (song_id: string, next: string) => {
    if (!userId) return;

    const prev = items.find((x) => x.song_id === song_id)?.confidence ?? null;

    // optimistic UI
    setItems((cur) =>
      cur.map((it) => (it.song_id === song_id ? { ...it, confidence: next } : it))
    );

    startTransition(async () => {
      const { error } = await supabase
        .from("user_songs")
        .update({ confidence: next })
        .eq("user_id", userId)
        .eq("song_id", song_id);

      if (error) {
        // rollback
        setItems((cur) =>
          cur.map((it) => (it.song_id === song_id ? { ...it, confidence: prev } : it))
        );
        alert(error.message);
      }
    });
  };

  const removeFromRepertoire = (song_id: string) => {
    if (!userId) return;

    startTransition(async () => {
      const { error } = await supabase
        .from("user_songs")
        .delete()
        .eq("user_id", userId)
        .eq("song_id", song_id);

      if (error) {
        alert(error.message);
        return;
      }

      setItems((prev) => prev.filter((x) => x.song_id !== song_id));
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">My Repertoire</h1>
        <div className="mt-4 text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">My Repertoire</h1>
        <p className="text-sm text-muted-foreground">
          {items.length} song{items.length === 1 ? "" : "s"}
          {isPending ? "…" : ""}
        </p>
      </div>

      {errorMsg ? (
        <pre className="whitespace-pre-wrap rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-700">
          {errorMsg}
        </pre>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-md border p-4 text-sm">
          <div className="font-medium">Your repertoire is empty.</div>
          <div className="mt-1 text-muted-foreground">Add songs from the Songs page.</div>
          <Link
            href="/songs"
            className="mt-3 inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Browse Songs
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title / artist / tags…"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />

            <select
              value={confidenceFilter}
              onChange={(e) => setConfidenceFilter(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm sm:w-56"
            >
              <option value="all">All confidence</option>
              {CONFIDENCE_LEVELS.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <div className="text-sm text-muted-foreground">
            Showing {filtered.length} of {items.length}
          </div>

          <div className="divide-y rounded-md border">
            {filtered.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No matches.</div>
            ) : (
              filtered.map((it) => (
                <div
                  key={it.song_id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      <Link href={`/songs/${it.slug ?? it.song_id}`} className="hover:text-amber-600">
                        {it.title}
                      </Link>
                      {it.composers.length > 0 && (
                        <span className="ml-1 font-normal text-slate-400">
                          ({it.composers.map((name) => {
                            const parts = name.trim().split(" ");
                            return parts.length > 1
                              ? `${parts[0][0]}. ${parts.slice(1).join(" ")}`
                              : name;
                          }).join(", ")})
                        </span>
                      )}
                    </div>
                    <div className="truncate text-sm text-muted-foreground">
                      {it.display_artist ?? "—"}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full border px-2 py-0.5">
                        {confidenceLabel(it.confidence)}
                      </span>

                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:shrink-0">
                    <select
                      value={(it.confidence ?? "") as ConfidenceKey | ""}
                      onChange={(e) => updateConfidence(it.song_id, e.target.value)}
                      className="rounded-md border px-2 py-1.5 text-sm"
                      aria-label="Confidence"
                    >
                      <option value="">Unrated</option>
                      {CONFIDENCE_LEVELS.map((l) => (
                        <option key={l.key} value={l.key}>
                          {l.label}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => removeFromRepertoire(it.song_id)}
                      className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}