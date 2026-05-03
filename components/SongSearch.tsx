"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatComposers } from "@/lib/formatComposers";
import SubmitSongForm from "@/components/SubmitSongForm";

type Result = {
  song_id: string;
  title: string;
  display_artist: string | null;
  first_line: string | null;
  aka: string[] | null;
  score: number;
  composers: string[];
  cultures: string[];
  productions: string[];
  genres: string[];
  languages?: string[];
  year: number | null;
  slug: string | null;
};

type PopularSong = {
  song_id: string;
  title: string;
  slug: string | null;
  display_artist: string | null;
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
  popularity: number;
};

const LEVELS = [
  { key: "lead", label: "Lead" },
  { key: "support", label: "Support" },
  { key: "learn", label: "Learn" },
] as const;

const PAGE_SIZE = 20;

export default function SongSearch({ initialQuery = "" }: { initialQuery?: string }) {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [popularSongs, setPopularSongs] = useState<PopularSong[]>([]);
  const [songsLoading, setSongsLoading] = useState(true);
  const [singingVoice, setSingingVoice] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pendingAddId, setPendingAddId] = useState<string | null>(null);
  const [repertoire, setRepertoire] = useState<Map<string, string>>(new Map());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Filter state
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [selectedLanguages, setSelectedLanguages] = useState<Set<string>>(new Set());
  const [selectedThemes, setSelectedThemes] = useState<Set<string>>(new Set());
  const [selectedVibe, setSelectedVibe] = useState("");
  const [selectedTonality, setSelectedTonality] = useState("");
  const [selectedMeter, setSelectedMeter] = useState("");

  useEffect(() => {
    // User data — session reads from localStorage (fast), then fetches profile + repertoire
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      setCurrentUser(session.user);
      Promise.all([
        supabase.from("profiles").select("singing_voice").eq("id", session.user.id).single(),
        supabase.from("user_songs").select("song_id, confidence").eq("user_id", session.user.id),
      ]).then(([profileRes, repertoireRes]) => {
        setSingingVoice((profileRes.data as any)?.singing_voice ?? null);
        setRepertoire(new Map(((repertoireRes.data ?? []) as any[]).map((r) => [r.song_id, r.confidence ?? ""])));
      });
    });

    // Songs catalog — fires in parallel with the user fetch above
    const SONG_PAGE = 1000;
    async function fetchAllSongs() {
      const all: any[] = [];
      let from = 0;
      while (true) {
        const { data } = await supabase
          .from("songs")
          .select(`
            id, title, slug, display_artist, year_written, vibe, tonality, meter,
            song_composers(people(name)),
            song_lyricists(people(name)),
            song_recording_artists(year),
            song_productions(productions(name)),
            song_genres(genres(name)),
            song_languages(languages(name)),
            song_cultures(cultures(name)),
            song_themes(themes(name))
          `)
          .range(from, from + SONG_PAGE - 1);
        const page = data ?? [];
        all.push(...page);
        if (page.length < SONG_PAGE) break;
        from += SONG_PAGE;
      }
      return all;
    }
    Promise.all([fetchAllSongs(), supabase.rpc("song_popularity_counts")]).then(([songsData, popularityRes]) => {
      const popularityMap = new Map<string, number>(
        ((popularityRes.data ?? []) as { song_id: string; user_count: number }[]).map(
          (r) => [r.song_id, r.user_count]
        )
      );
      const songs = songsData
        .map((s: any) => ({
          song_id: s.id as string,
          title: s.title as string,
          slug: (s.slug ?? null) as string | null,
          display_artist: (s.display_artist ?? null) as string | null,
          vibe: (s.vibe ?? null) as string | null,
          tonality: (s.tonality ?? null) as string | null,
          meter: (s.meter ?? null) as string | null,
          productions: ((s.song_productions ?? []) as any[]).map((p: any) => p.productions?.name as string).filter(Boolean) as string[],
          composers: Array.from(new Set([
            ...((s.song_composers ?? []) as any[]).map((c: any) => c.people?.name as string),
            ...((s.song_lyricists ?? []) as any[]).map((c: any) => c.people?.name as string),
          ])).filter(Boolean).sort() as string[],
          genres: ((s.song_genres ?? []) as any[]).map((g: any) => g.genres?.name as string).filter(Boolean) as string[],
          languages: ((s.song_languages ?? []) as any[]).map((l: any) => l.languages?.name as string).filter(Boolean) as string[],
          cultures: ((s.song_cultures ?? []) as any[]).map((c: any) => c.cultures?.name as string).filter(Boolean) as string[],
          themes: ((s.song_themes ?? []) as any[]).map((t: any) => t.themes?.name as string).filter(Boolean) as string[],
          year: (() => {
            const firstRecording = ((s.song_recording_artists ?? []) as any[])
              .map((r: any) => r.year as number)
              .filter((y): y is number => typeof y === "number")
              .sort((a, b) => a - b)[0] ?? null;
            const yearWritten = (s as any).year_written as number | null;
            if (yearWritten && firstRecording) return Math.min(yearWritten, firstRecording);
            return yearWritten ?? firstRecording ?? null;
          })(),
          popularity: popularityMap.get(s.id) ?? 0,
        }))
        .sort((a, b) => b.popularity - a.popularity || a.title.localeCompare(b.title));
      setPopularSongs(songs);
      setSongsLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const debounceRef = useRef<number | null>(null);
  const [debouncing, setDebouncing] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Derive filter options from the songs data
  const filterOptions = useMemo(() => {
    const genres = Array.from(new Set(popularSongs.flatMap((s) => s.genres))).sort();
    const languages = Array.from(new Set(popularSongs.flatMap((s) => s.languages))).sort();
    const themes = Array.from(new Set(popularSongs.flatMap((s) => s.themes))).sort();
    const vibes = Array.from(new Set(popularSongs.map((s) => s.vibe).filter(Boolean) as string[])).sort();
    const tonalities = Array.from(new Set(popularSongs.flatMap((s) => s.tonality ? s.tonality.split(/,\s*/) : []))).sort();
    const meters = Array.from(new Set(popularSongs.map((s) => s.meter).filter(Boolean) as string[])).sort();
    return { genres, languages, themes, vibes, tonalities, meters };
  }, [popularSongs]);

  const activeFilterCount =
    selectedGenres.size +
    selectedLanguages.size +
    selectedThemes.size +
    (selectedVibe ? 1 : 0) +
    (selectedTonality ? 1 : 0) +
    (selectedMeter ? 1 : 0);

  // Lookup map for filter metadata on search results
  const songMetaMap = useMemo(
    () => new Map(popularSongs.map((s) => [s.song_id, s])),
    [popularSongs]
  );

  function matchesFilters(meta: PopularSong | undefined): boolean {
    if (!meta) return true; // unknown song — don't exclude
    if (selectedGenres.size > 0 && !meta.genres.some((g) => selectedGenres.has(g))) return false;
    if (selectedLanguages.size > 0 && !meta.languages.some((l) => selectedLanguages.has(l))) return false;
    if (selectedThemes.size > 0 && !meta.themes.some((t) => selectedThemes.has(t))) return false;
    if (selectedVibe && meta.vibe !== selectedVibe) return false;
    if (selectedTonality && !meta.tonality?.split(/,\s*/).includes(selectedTonality)) return false;
    if (selectedMeter && meta.meter !== selectedMeter) return false;
    return true;
  }

  // Browse list: exclude repertoire songs and apply filters
  const filteredSongs = useMemo(() => {
    return popularSongs.filter((s) => {
      if (repertoire.has(s.song_id)) return false;
      return matchesFilters(s);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popularSongs, repertoire, selectedGenres, selectedLanguages, selectedThemes, selectedVibe, selectedTonality, selectedMeter]);

  // Search results: apply active filters using the metadata map
  const filteredResults = useMemo(() => {
    if (activeFilterCount === 0) return results;
    return results.filter((r) => matchesFilters(songMetaMap.get(r.song_id)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, songMetaMap, selectedGenres, selectedLanguages, selectedThemes, selectedVibe, selectedTonality, selectedMeter, activeFilterCount]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedGenres, selectedLanguages, selectedThemes, selectedVibe, selectedTonality, selectedMeter]);

  // Infinite scroll observer
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredSongs.length));
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [filteredSongs.length]);


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
    if (initialQuery.trim()) runSearch(initialQuery);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setDebouncing(false);
      runSearch(q);
    }, 200);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function handlePendingAdd(songId: string) {
    const { data } = await supabase.auth.getSession();
    if (!data.session) { router.push("/auth"); return; }
    setPendingAddId(songId);
  }

  async function addSong(songId: string, level: string) {
    setStatus(null);
    setPendingAddId(null);

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

  function toggleGenre(g: string) {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  }

  function toggleLanguage(l: string) {
    setSelectedLanguages((prev) => {
      const next = new Set(prev);
      next.has(l) ? next.delete(l) : next.add(l);
      return next;
    });
  }

  function toggleTheme(t: string) {
    setSelectedThemes((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  }

  function clearFilters() {
    setSelectedGenres(new Set());
    setSelectedLanguages(new Set());
    setSelectedThemes(new Set());
    setSelectedVibe("");
    setSelectedTonality("");
    setSelectedMeter("");
  }

  const visibleSongs = filteredSongs.slice(0, visibleCount);
  const searching = q.trim().length > 0;

  return (
    <div className="space-y-3">
      {/* Search box */}
      <div className="rounded-2xl border border-zinc-200 p-5 shadow-sm space-y-3">
        <div>
          <label className="block text-sm font-medium">Search</label>
          <input
            className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
            value={q}
            onChange={(e) => { setQ(e.target.value); setDebouncing(!!e.target.value.trim()); }}
            placeholder="Search by title, first line, recording artist, or composer"
          />
          <div className="mt-1 text-xs text-zinc-500">
            Tip: searching a person name returns songs connected via composer credits or recordings.
          </div>
        </div>

        <div className="text-xs text-zinc-500">
          {loading || debouncing
            ? "Searching…"
            : q.trim()
              ? `${filteredResults.length} song(s)${activeFilterCount > 0 && filteredResults.length < results.length ? ` (${results.length} before filters)` : ""}`
              : "Type to search"}
        </div>

        {status ? <div className="text-sm text-zinc-700">{status}</div> : null}
      </div>

      {/* Filter bar — shown in both search and browse modes */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide px-1">
            {searching ? null : songsLoading ? null : `${filteredSongs.length} song${filteredSongs.length === 1 ? "" : "s"}`}
          </p>
            <button
              onClick={() => setFiltersOpen((o) => !o)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
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

          {/* Filter panel */}
          {filtersOpen && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm space-y-4">
              {filterOptions.genres.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-medium text-zinc-500 uppercase tracking-wide">Genre</div>
                  <div className="flex flex-wrap gap-1.5">
                    {filterOptions.genres.map((g) => (
                      <button
                        key={g}
                        onClick={() => toggleGenre(g)}
                        className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                          selectedGenres.has(g)
                            ? "border-amber-400 bg-amber-50 text-amber-700"
                            : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {filterOptions.languages.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-medium text-zinc-500 uppercase tracking-wide">Language</div>
                  <div className="flex flex-wrap gap-1.5">
                    {filterOptions.languages.map((l) => (
                      <button
                        key={l}
                        onClick={() => toggleLanguage(l)}
                        className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                          selectedLanguages.has(l)
                            ? "border-amber-400 bg-amber-50 text-amber-700"
                            : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {filterOptions.themes.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-medium text-zinc-500 uppercase tracking-wide">Theme</div>
                  <div className="flex flex-wrap gap-1.5">
                    {filterOptions.themes.map((t) => (
                      <button
                        key={t}
                        onClick={() => toggleTheme(t)}
                        className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                          selectedThemes.has(t)
                            ? "border-amber-400 bg-amber-50 text-amber-700"
                            : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                {filterOptions.vibes.length > 0 && (
                  <div className="flex-1 min-w-[120px]">
                    <label className="mb-1 block text-xs font-medium text-zinc-500 uppercase tracking-wide">Vibe</label>
                    <select
                      value={selectedVibe}
                      onChange={(e) => setSelectedVibe(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">Any</option>
                      {filterOptions.vibes.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                )}

                {filterOptions.tonalities.length > 0 && (
                  <div className="flex-1 min-w-[120px]">
                    <label className="mb-1 block text-xs font-medium text-zinc-500 uppercase tracking-wide">Tonality</label>
                    <select
                      value={selectedTonality}
                      onChange={(e) => setSelectedTonality(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">Any</option>
                      {filterOptions.tonalities.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                )}

                {filterOptions.meters.length > 0 && (
                  <div className="flex-1 min-w-[120px]">
                    <label className="mb-1 block text-xs font-medium text-zinc-500 uppercase tracking-wide">Meter</label>
                    <select
                      value={selectedMeter}
                      onChange={(e) => setSelectedMeter(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">Any</option>
                      {filterOptions.meters.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                >
                  ✕ Clear {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
                </button>
              )}
            </div>
          )}

        {/* Song list: search results or browse list */}
        {searching ? (
          <div className="grid gap-2">
            {filteredResults.map((r) => (
              <SongCard
                key={r.song_id}
                songId={r.song_id}
                title={r.title}
                slug={r.slug}
                displayArtist={r.display_artist}
                composers={r.composers}
                cultures={r.cultures ?? []}
                productions={r.productions}
                year={r.year}
                aka={r.aka}
                genres={r.genres}
                languages={r.languages ?? []}
                repertoire={repertoire}
                pendingAddId={pendingAddId}
                singingVoice={singingVoice}
                setPendingAddId={setPendingAddId}
                onAdd={handlePendingAdd}
                addSong={addSong}
              />
            ))}
            {!loading && !debouncing && filteredResults.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 p-5 text-sm text-zinc-600">
                {results.length > 0 ? "No results match the active filters." : "No songs found."}
              </div>
            ) : null}
          </div>
        ) : songsLoading ? (
          <div className="py-6 text-center text-sm text-zinc-400">Loading songs…</div>
        ) : popularSongs.length > 0 ? (
          <div className="grid gap-2">
            {visibleSongs.map((r) => (
              <SongCard
                key={r.song_id}
                songId={r.song_id}
                title={r.title}
                slug={r.slug}
                displayArtist={r.display_artist}
                composers={r.composers}
                cultures={r.cultures}
                productions={r.productions}
                year={r.year}
                aka={null}
                genres={r.genres}
                languages={r.languages ?? []}
                repertoire={repertoire}
                pendingAddId={pendingAddId}
                singingVoice={singingVoice}
                setPendingAddId={setPendingAddId}
                onAdd={handlePendingAdd}
                addSong={addSong}
              />
            ))}

            {/* Sentinel for infinite scroll */}
            {visibleCount < filteredSongs.length && (
              <div ref={sentinelRef} className="py-4 text-center text-xs text-zinc-400">
                Loading more…
              </div>
            )}

            {visibleCount >= filteredSongs.length && filteredSongs.length > PAGE_SIZE && (
              <div className="py-4 text-center text-xs text-zinc-400">
                All {filteredSongs.length} songs shown
              </div>
            )}

            {filteredSongs.length === 0 && (
              <div className="rounded-2xl border border-zinc-200 p-5 text-sm text-zinc-600">
                No songs match the selected filters.
              </div>
            )}
          </div>
        ) : null}
      </div>

      {currentUser && <SubmitSongForm />}
    </div>
  );
}

// ─── Shared song card ────────────────────────────────────────────────────────

function SongCard({
  songId,
  title,
  slug,
  displayArtist,
  composers,
  cultures,
  productions,
  year,
  aka,
  genres,
  languages,
  repertoire,
  pendingAddId,
  singingVoice,
  setPendingAddId,
  onAdd,
  addSong,
}: {
  songId: string;
  title: string;
  slug: string | null;
  displayArtist: string | null;
  composers: string[];
  cultures: string[];
  productions: string[];
  year: number | null;
  aka: string[] | null;
  genres: string[];
  languages: string[];
  repertoire: Map<string, string>;
  pendingAddId: string | null;
  singingVoice: string | null;
  setPendingAddId: (id: string | null) => void;
  onAdd: (id: string) => void | Promise<void>;
  addSong: (songId: string, level: string) => void;
}) {
  const inRepertoire = repertoire.has(songId);
  const confidence = repertoire.get(songId);
  const confidenceLabel = LEVELS.find((l) => l.key === confidence)?.label ?? confidence;
  const picking = pendingAddId === songId;
  const href = `/songs/${slug ?? songId}`;

  return (
    <div className="rounded-2xl border border-zinc-200 p-4 shadow-sm">
      <div className="min-w-0">
        <div className="font-medium">
          <Link href={href} className="hover:text-amber-600">
            {title}
          </Link>
          {composers.length > 0 && (
            <span className="ml-1 font-normal text-zinc-400">
              ({formatComposers(composers, cultures ?? [])})
            </span>
          )}
          {productions && productions.length > 0 ? (
            <span className="text-zinc-500 font-normal"> — <em>{productions.join(", ")}</em></span>
          ) : displayArtist ? (
            <span className="text-zinc-500 font-normal"> — {displayArtist}</span>
          ) : null}
          {year && (
            <span className="ml-1 font-normal text-zinc-400">({year})</span>
          )}
        </div>
        {aka && aka.length ? (
          <div className="text-xs text-zinc-500">aka: {aka.join(" · ")}</div>
        ) : null}
        {inRepertoire && (
          <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-700">
            ✓ In your repertoire{confidenceLabel ? ` · ${confidenceLabel}` : ""}
          </div>
        )}
      </div>
      {genres.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[...genres].sort().map((g) => (
            <span key={g} className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-500">
              {g}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Link
          href={href}
          className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50"
        >
          View
        </Link>
        {picking ? (
          <>
            {LEVELS.map((l) => {
              const blocked = l.key === "lead" && (!singingVoice || singingVoice === "none");
              return (
                <span key={l.key} className="relative group">
                  <button
                    disabled={blocked}
                    className={`rounded-xl border px-3 py-1.5 text-sm ${
                      blocked
                        ? "border-zinc-200 bg-zinc-100 text-zinc-400 cursor-not-allowed"
                        : "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors delay-150"
                    }`}
                    onClick={() => !blocked && addSong(songId, l.key)}
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
            <button
              className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50"
              onClick={() => onAdd(songId)}
            >
              {inRepertoire ? "Update" : "Add"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
