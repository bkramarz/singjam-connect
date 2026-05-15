"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatComposers } from "@/lib/formatComposers";
import { matchesSearch } from "@/lib/normalizeSearch";
import SubmitSongForm from "@/components/SubmitSongForm";
import { useSongFilters } from "@/hooks/useSongFilters";
import { useSongSearch, type SongSearchResult } from "@/hooks/useSongSearch";
import { SortDropdown } from "@/components/SortDropdown";
import { FilterPanel } from "@/components/FilterPanel";

const CONFIDENCE_LEVELS = [
  { key: "lead", label: "Lead" },
  { key: "support", label: "Support" },
  { key: "learn", label: "Learn" },
] as const;

const SORT_OPTIONS = [
  { value: "title_asc" as const, label: "A → Z" },
  { value: "title_desc" as const, label: "Z → A" },
  { value: "popularity" as const, label: "Popular" },
];

type ConfidenceKey = (typeof CONFIDENCE_LEVELS)[number]["key"];

type Item = {
  song_id: string;
  slug: string | null;
  confidence: string | null;
  updated_at: string | null;
  title: string;
  display_artist: string | null;
  first_line: string | null;
  hook: string | null;
  notes: string | null;
  composers: string[];
  cultures: string[];
  productions: string[];
  genres: string[];
  languages: string[];
  themes: string[];
  vibe: string | null;
  tonality: string | null;
  meter: string | null;
  year: number | null;
  popularity?: number;
};


export default function RepertoirePage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [singingVoice, setSingingVoice] = useState<string | null>(null);

  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("q") ?? "";
  });
  const [confidenceFilter, setConfidenceFilter] = useState<string>(() => {
    if (typeof window === "undefined") return "all";
    return new URLSearchParams(window.location.search).get("role") ?? "all";
  });
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [pendingAddId, setPendingAddId] = useState<string | null>(null);
  const [userSets, setUserSets] = useState<{ id: string; name: string }[]>([]);
  const [addToSetFor, setAddToSetFor] = useState<string | null>(null);
  const [addToSetStatus, setAddToSetStatus] = useState<Record<string, string>>({});
  const { results: searchResults, loading: searchLoading } = useSongSearch(query);

  const [isPending, startTransition] = useTransition();

  const {
    filterOptions, matchesFilters,
    selectedGenres, selectedLanguages, selectedThemes, selectedCultures,
    selectedVibe, setSelectedVibe,
    selectedTonality, setSelectedTonality,
    selectedMeter, setSelectedMeter,
    yearMin, setYearMin,
    yearMax, setYearMax,
    yearBounds,
    activeFilterCount,
    toggleGenre, toggleLanguage, toggleTheme, toggleCulture, clearFilters,
    sortBy, setSortBy,
  } = useSongFilters(items, "title_asc");

  useEffect(() => {
    let cancelled = false;

    async function load() {
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

        const PAGE = 1000;
        async function fetchAllUserSongs() {
          const all: any[] = [];
          let from = 0;
          while (true) {
            const { data, error } = await supabase
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
                  first_line,
                  hook,
                  notes,
                  vibe,
                  tonality,
                  meter,
                  year_written,
                  song_composers ( people ( name ) ),
                  song_lyricists ( people ( name ) ),
                  song_cultures ( cultures ( name ) ),
                  song_productions ( productions ( name ) ),
                  song_genres ( genres ( name ) ),
                  song_languages ( languages ( name ) ),
                  song_themes ( themes ( name ) ),
                  song_recording_artists ( year )
                )
              `
              )
              .eq("user_id", uid)
              .order("updated_at", { ascending: false })
              .range(from, from + PAGE - 1);
            if (error) throw error;
            const page = data ?? [];
            all.push(...page);
            if (page.length < PAGE) break;
            from += PAGE;
          }
          return all;
        }

        const [{ data: p }, rows, popularityRes, setsJson] = await Promise.all([
          supabase.from("profiles").select("singing_voice").eq("id", uid).single(),
          fetchAllUserSongs(),
          supabase.rpc("song_popularity_counts"),
          fetch("/api/sets").then((r) => (r.ok ? r.json() : { owned: [], collaborating: [] })),
        ]);

        setSingingVoice((p as any)?.singing_voice ?? null);
        setUserSets([...(setsJson.owned ?? []), ...(setsJson.collaborating ?? [])]);

        if (cancelled) return;

        const popularityMap = new Map<string, number>(
          ((popularityRes.data ?? []) as { song_id: string; user_count: number }[]).map(
            (r) => [r.song_id, r.user_count]
          )
        );

        const typed = rows as any[];
        const flattened: Item[] = typed
          .filter((r) => r.songs)
          .map((r) => {
            const names = new Set<string>([
              ...(r.songs.song_composers ?? []).map((c: any) => c.people?.name).filter(Boolean),
              ...(r.songs.song_lyricists ?? []).map((l: any) => l.people?.name).filter(Boolean),
            ]);
            return {
              song_id: r.song_id,
              slug: r.songs.slug ?? null,
              confidence: r.confidence,
              updated_at: r.updated_at,
              title: r.songs.title,
              display_artist: r.songs.display_artist,
              first_line: r.songs.first_line ?? null,
              hook: r.songs.hook ?? null,
              notes: r.songs.notes ?? null,
              vibe: r.songs.vibe ?? null,
              tonality: r.songs.tonality ?? null,
              meter: r.songs.meter ?? null,
              year: (() => {
                const recordings = (r.songs.song_recording_artists ?? []) as any[];
                const firstRecording = recordings
                  .map((rec: any) => rec.year as number)
                  .filter((y): y is number => typeof y === "number")
                  .sort((a, b) => a - b)[0] ?? null;
                const yearWritten = (r.songs.year_written ?? null) as number | null;
                if (yearWritten && firstRecording) return Math.min(yearWritten, firstRecording);
                return yearWritten ?? firstRecording ?? null;
              })(),
              composers: [...names].sort(),
              cultures: (r.songs.song_cultures ?? []).map((c: any) => c.cultures?.name).filter(Boolean),
              productions: (r.songs.song_productions ?? []).map((p: any) => p.productions?.name).filter(Boolean),
              genres: (r.songs.song_genres ?? []).map((g: any) => g.genres?.name).filter(Boolean),
              languages: (r.songs.song_languages ?? []).map((l: any) => l.languages?.name).filter(Boolean),
              themes: (r.songs.song_themes ?? []).map((t: any) => t.themes?.name).filter(Boolean),
              popularity: popularityMap.get(r.song_id),
            };
          });

        setItems(flattened.sort((a, b) => a.title.localeCompare(b.title)));
      } catch (e: any) {
        console.error("Repertoire load exception:", e);
        setErrorMsg("Something went wrong. Please try again.");
        setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (query) { params.set("q", query); } else { params.delete("q"); }
    if (confidenceFilter !== "all") { params.set("role", confidenceFilter); } else { params.delete("role"); }
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [query, confidenceFilter]);

  const repertoireMap = useMemo(() => new Map(items.map((it) => [it.song_id, it])), [items]);
  const searching = query.trim().length > 0;

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (confidenceFilter !== "all" && (it.confidence ?? "") !== confidenceFilter) return false;
      if (!matchesFilters(it)) return false;
      const hay = [it.title, it.display_artist ?? "", ...it.composers, ...it.productions, it.first_line ?? "", it.hook ?? "", it.notes ?? ""].join(" ");
      return matchesSearch(hay, query);
    });
  }, [items, query, confidenceFilter, matchesFilters]);

  const sortedFiltered = useMemo(() => {
    const list = [...filtered];
    if (sortBy === "popularity") return list.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0) || a.title.localeCompare(b.title));
    if (sortBy === "title_desc") return list.sort((a, b) => b.title.localeCompare(a.title));
    return list.sort((a, b) => a.title.localeCompare(b.title));
  }, [filtered, sortBy]);

  const updateConfidence = (song_id: string, next: string) => {
    if (!userId) return;
    const prev = items.find((x) => x.song_id === song_id)?.confidence ?? null;
    setItems((cur) => cur.map((it) => (it.song_id === song_id ? { ...it, confidence: next } : it)));
    startTransition(async () => {
      const { error } = await supabase
        .from("user_songs")
        .update({ confidence: next })
        .eq("user_id", userId)
        .eq("song_id", song_id);
      if (error) {
        setItems((cur) => cur.map((it) => (it.song_id === song_id ? { ...it, confidence: prev } : it)));
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
      if (error) { alert(error.message); return; }
      setItems((prev) => prev.filter((x) => x.song_id !== song_id));
    });
  };

  const addSong = (songId: string, confidence: string, result: SongSearchResult) => {
    if (!userId) return;
    setPendingAddId(null);
    startTransition(async () => {
      const { error } = await supabase.from("user_songs").upsert(
        { user_id: userId, song_id: songId, confidence, updated_at: new Date().toISOString() },
        { onConflict: "user_id,song_id" }
      );
      if (error) { alert(error.message); return; }
      setItems((prev) => {
        if (prev.find((x) => x.song_id === songId)) {
          return prev.map((x) => x.song_id === songId ? { ...x, confidence } : x);
        }
        const newItem: Item = {
          song_id: songId,
          slug: result.slug ?? null,
          confidence,
          updated_at: new Date().toISOString(),
          title: result.title,
          display_artist: result.display_artist ?? null,
          first_line: result.first_line ?? null,
          hook: null,
          notes: null,
          composers: result.composers ?? [],
          cultures: result.cultures ?? [],
          productions: result.productions ?? [],
          genres: result.genres ?? [],
          languages: result.languages ?? [],
          themes: [],
          vibe: null,
          tonality: null,
          meter: null,
          year: null,
        };
        return [...prev, newItem].sort((a, b) => a.title.localeCompare(b.title));
      });
    });
  };

  async function addToSet(songId: string, setId: string) {
    setAddToSetFor(null);
    const set = userSets.find((s) => s.id === setId);
    const res = await fetch(`/api/sets/${setId}/songs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ songId }),
    });
    const msg = res.ok
      ? `Added to ${set?.name ?? "set"}`
      : res.status === 409
      ? "Already in that set"
      : null;
    if (msg) {
      setAddToSetStatus((prev) => ({ ...prev, [songId]: msg }));
      setTimeout(
        () => setAddToSetStatus((prev) => { const { [songId]: _, ...rest } = prev; return rest; }),
        2500
      );
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">My Repertoire</h1>
          <div className="mt-1 h-3 w-16 animate-pulse rounded bg-zinc-200" />
        </div>
        <div className="rounded-2xl border border-zinc-200 p-5 shadow-sm">
          <div className="h-9 animate-pulse rounded-xl bg-zinc-100" />
        </div>
        <div className="divide-y rounded-md border">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="flex items-center justify-between p-4">
              <div className="space-y-1.5">
                <div className="h-4 w-48 animate-pulse rounded bg-zinc-200" />
                <div className="h-3 w-32 animate-pulse rounded bg-zinc-100" />
              </div>
              <div className="h-8 w-24 animate-pulse rounded-xl bg-zinc-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">My Repertoire</h1>
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

      {/* Search bar — always visible */}
      <div className="rounded-2xl border border-zinc-200 p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, songwriter, or artist…"
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
            />
          </div>

          {!searching && (
            <select
              value={confidenceFilter}
              onChange={(e) => setConfidenceFilter(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm sm:w-56"
            >
              <option value="all">Any role</option>
              {CONFIDENCE_LEVELS.map((l) => (
                <option key={l.key} value={l.key}>{l.label}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Search results mode */}
      {searching ? (
        <>
          <div className="text-sm text-muted-foreground px-1">
            {searchLoading ? "Searching…" : `${searchResults.length} result${searchResults.length === 1 ? "" : "s"}`}
          </div>
          <div className="divide-y rounded-md border">
            {!searchLoading && searchResults.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No songs found.</div>
            ) : (
              searchResults.map((result) => {
                const inRep = repertoireMap.get(result.song_id);
                const isPicking = pendingAddId === result.song_id;
                const href = `/songs/${result.slug ?? result.song_id}`;
                return (
                  <div key={result.song_id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        <Link href={href} className="hover:text-amber-600">
                          {result.title}
                        </Link>
                        {result.composers.length > 0 && (
                          <span className="ml-1 font-normal text-slate-400">
                            ({formatComposers(result.composers, result.cultures ?? [])})
                          </span>
                        )}
                      </div>
                      <div className="truncate text-sm text-muted-foreground">
                        {result.productions.length > 0
                          ? <>from <em>{result.productions.join(", ")}</em></>
                          : result.display_artist ?? "—"}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                      {inRep ? (
                        <>
                          <select
                            value={(inRep.confidence ?? "") as ConfidenceKey}
                            onChange={(e) => updateConfidence(inRep.song_id, e.target.value)}
                            className={`rounded-xl border px-2 py-1.5 text-sm ${
                              inRep.confidence === "lead"
                                ? "border-amber-400 bg-amber-100 text-amber-800 font-semibold"
                                : "border-zinc-200"
                            }`}
                            aria-label="Role"
                          >
                            {CONFIDENCE_LEVELS.map((l) => (
                              <option
                                key={l.key}
                                value={l.key}
                                disabled={l.key === "lead" && (!singingVoice || singingVoice === "none")}
                              >
                                {l.key === "lead" && (!singingVoice || singingVoice === "none") ? "Lead (singers only)" : l.label}
                              </option>
                            ))}
                          </select>
                          {userSets.length > 0 && (
                            addToSetFor === result.song_id ? (
                              <div className="flex items-center gap-1.5">
                                <select
                                  className="rounded-xl border border-zinc-300 px-2 py-1.5 text-sm"
                                  defaultValue=""
                                  onChange={(e) => { if (e.target.value) addToSet(result.song_id, e.target.value); }}
                                >
                                  <option value="" disabled>Pick a set…</option>
                                  {userSets.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => setAddToSetFor(null)}
                                  className="text-zinc-400 hover:text-zinc-600 text-sm"
                                  aria-label="Cancel"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : addToSetStatus[result.song_id] ? (
                              <span className="text-xs text-green-600">{addToSetStatus[result.song_id]}</span>
                            ) : (
                              <button
                                onClick={() => setAddToSetFor(result.song_id)}
                                className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                              >
                                Add to set
                              </button>
                            )
                          )}
                          <Link
                            href={href}
                            className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                          >
                            View
                          </Link>
                          <button
                            onClick={() => removeFromRepertoire(inRep.song_id)}
                            className="rounded-xl border border-zinc-200 px-2 py-1 text-xs text-zinc-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500 transition-colors"
                          >
                            Remove
                          </button>
                        </>
                      ) : isPicking ? (
                        <>
                          {CONFIDENCE_LEVELS.map((l) => {
                            const blocked = l.key === "lead" && (!singingVoice || singingVoice === "none");
                            return (
                              <span key={l.key} className="relative group">
                                <button
                                  disabled={blocked}
                                  className={`rounded-xl border px-3 py-1.5 text-sm ${
                                    blocked
                                      ? "border-zinc-200 bg-zinc-100 text-zinc-400 cursor-not-allowed"
                                      : "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                                  }`}
                                  onClick={() => !blocked && addSong(result.song_id, l.key, result)}
                                >
                                  {l.label}
                                </button>
                                {blocked && (
                                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block whitespace-nowrap rounded-lg bg-zinc-800 px-2 py-1 text-xs text-white z-10">
                                    Only available for singers
                                  </span>
                                )}
                              </span>
                            );
                          })}
                          <button
                            className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50"
                            onClick={() => setPendingAddId(null)}
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <>
                          <Link
                            href={href}
                            className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                          >
                            View
                          </Link>
                          <button
                            onClick={() => setPendingAddId(result.song_id)}
                            className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                          >
                            Add
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <SubmitSongForm />
        </>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <p className="text-base font-semibold text-zinc-900">Your repertoire is empty</p>
          <p className="mt-1 text-sm text-zinc-500">Add songs you know and SingJam will match you with musicians who share your repertoire.</p>
          <p className="mt-3 text-sm text-zinc-400">Search for a song above, or browse the full catalog below.</p>
          <Link
            href="/search"
            className="mt-4 inline-block rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-400 transition-colors"
          >
            Browse songs →
          </Link>
        </div>
      ) : (
        <>
          {/* Filter bar */}
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide px-1">
              {sortedFiltered.length} of {items.length}
            </p>
            <div className="flex items-center gap-2">
              <SortDropdown value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
              <button
                onClick={() => setFiltersOpen((o) => !o)}
                className={`h-7 flex items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors ${
                  activeFilterCount > 0
                    ? "border-amber-400 bg-amber-50 text-amber-700"
                    : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                }`}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M1.5 3h13a.5.5 0 0 1 0 1H1.5a.5.5 0 0 1 0-1zm2 4h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1 0-1zm3 4h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1 0-1z" />
                </svg>
                Filters{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
              </button>
            </div>
          </div>

          {filtersOpen && (
            <FilterPanel
              filterOptions={filterOptions}
              selectedGenres={selectedGenres}
              selectedLanguages={selectedLanguages}
              selectedThemes={selectedThemes}
              selectedCultures={selectedCultures}
              selectedVibe={selectedVibe}
              setSelectedVibe={setSelectedVibe}
              selectedTonality={selectedTonality}
              setSelectedTonality={setSelectedTonality}
              selectedMeter={selectedMeter}
              setSelectedMeter={setSelectedMeter}
              yearMin={yearMin}
              setYearMin={setYearMin}
              yearMax={yearMax}
              setYearMax={setYearMax}
              yearBounds={yearBounds}
              activeFilterCount={activeFilterCount}
              toggleGenre={toggleGenre}
              toggleLanguage={toggleLanguage}
              toggleTheme={toggleTheme}
              toggleCulture={toggleCulture}
              clearFilters={clearFilters}
            />
          )}

          <div className="divide-y rounded-md border">
            {sortedFiltered.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No matches.</div>
            ) : (
              sortedFiltered.map((it) => (
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
                          ({formatComposers(it.composers, it.cultures)})
                        </span>
                      )}
                    </div>
                    <div className="truncate text-sm text-muted-foreground">
                      {it.productions.length > 0
                        ? <>from <em>{it.productions.join(", ")}</em></>
                        : it.display_artist ?? "—"}
                    </div>
                    {(it.popularity ?? 0) > 0 && (
                      <div className="text-xs text-zinc-400">{it.popularity} {it.popularity === 1 ? "jammer" : "jammers"}</div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                    <select
                      value={(it.confidence ?? "") as ConfidenceKey}
                      onChange={(e) => updateConfidence(it.song_id, e.target.value)}
                      className={`rounded-xl border px-2 py-1.5 text-sm ${
                        it.confidence === "lead"
                          ? "border-amber-400 bg-amber-100 text-amber-800 font-semibold"
                          : "border-zinc-200"
                      }`}
                      aria-label="Confidence"
                    >
                      {CONFIDENCE_LEVELS.map((l) => (
                        <option
                          key={l.key}
                          value={l.key}
                          disabled={l.key === "lead" && (!singingVoice || singingVoice === "none")}
                        >
                          {l.key === "lead" && (!singingVoice || singingVoice === "none") ? "Lead (singers only)" : l.label}
                        </option>
                      ))}
                    </select>

                    {userSets.length > 0 && (
                      addToSetFor === it.song_id ? (
                        <div className="flex items-center gap-1.5">
                          <select
                            className="rounded-xl border border-zinc-300 px-2 py-1.5 text-sm"
                            defaultValue=""
                            onChange={(e) => { if (e.target.value) addToSet(it.song_id, e.target.value); }}
                          >
                            <option value="" disabled>Pick a set…</option>
                            {userSets.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => setAddToSetFor(null)}
                            className="text-zinc-400 hover:text-zinc-600 text-sm"
                            aria-label="Cancel"
                          >
                            ✕
                          </button>
                        </div>
                      ) : addToSetStatus[it.song_id] ? (
                        <span className="text-xs text-green-600">{addToSetStatus[it.song_id]}</span>
                      ) : (
                        <button
                          onClick={() => setAddToSetFor(it.song_id)}
                          className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                        >
                          Add to set
                        </button>
                      )
                    )}

                    <Link
                      href={`/songs/${it.slug ?? it.song_id}`}
                      className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                    >
                      View
                    </Link>

                    <button
                      onClick={() => removeFromRepertoire(it.song_id)}
                      className="rounded-xl border border-zinc-200 px-2 py-1 text-xs text-zinc-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500 transition-colors"
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
