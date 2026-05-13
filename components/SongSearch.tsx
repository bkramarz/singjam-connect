"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatComposers } from "@/lib/formatComposers";
import SubmitSongForm from "@/components/SubmitSongForm";
import { useSongFilters } from "@/hooks/useSongFilters";
import { useSongSearch, type SongSearchResult } from "@/hooks/useSongSearch";
import { SortDropdown } from "@/components/SortDropdown";
import { FilterPanel } from "@/components/FilterPanel";

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

const SORT_OPTIONS = [
  { value: "popularity" as const, label: "Popular" },
  { value: "title_asc" as const, label: "A → Z" },
  { value: "title_desc" as const, label: "Z → A" },
];

export default function SongSearch({ initialQuery = "" }: { initialQuery?: string }) {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [popularSongs, setPopularSongs] = useState<PopularSong[]>([]);
  const [songsLoading, setSongsLoading] = useState(true);
  const [singingVoice, setSingingVoice] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [q, setQ] = useState(initialQuery);
  const [status, setStatus] = useState<string | null>(null);
  const [pendingAddId, setPendingAddId] = useState<string | null>(null);
  const [repertoire, setRepertoire] = useState<Map<string, string>>(new Map());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hideMySongs, setHideMySongs] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const { results, loading, error: searchError } = useSongSearch(q, { limit: 50, debounceMs: 200 });

  const {
    filterOptions, matchesFilters,
    selectedGenres, selectedLanguages, selectedThemes,
    selectedVibe, setSelectedVibe,
    selectedTonality, setSelectedTonality,
    selectedMeter, setSelectedMeter,
    activeFilterCount,
    toggleGenre, toggleLanguage, toggleTheme, clearFilters,
    sortBy, setSortBy,
  } = useSongFilters(popularSongs, "popularity");

  // Lookup map for filter metadata on search results
  const songMetaMap = useMemo(
    () => new Map(popularSongs.map((s) => [s.song_id, s])),
    [popularSongs]
  );

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

  // Browse list: optionally exclude repertoire songs, then apply filters
  const filteredSongs = useMemo(() => {
    return popularSongs.filter((s) => {
      if (hideMySongs && repertoire.has(s.song_id)) return false;
      return matchesFilters(s);
    });
  }, [popularSongs, repertoire, matchesFilters, hideMySongs]);

  // Search results: apply active filters using the metadata map
  const filteredResults = useMemo(() => {
    if (activeFilterCount === 0) return results;
    return results.filter((r) => matchesFilters(songMetaMap.get(r.song_id)));
  }, [results, songMetaMap, activeFilterCount, matchesFilters]);

  const sortedBrowse = useMemo(() => {
    if (sortBy === "title_asc") return [...filteredSongs].sort((a, b) => a.title.localeCompare(b.title));
    if (sortBy === "title_desc") return [...filteredSongs].sort((a, b) => b.title.localeCompare(a.title));
    return [...filteredSongs].sort((a, b) => b.popularity - a.popularity || a.title.localeCompare(b.title));
  }, [filteredSongs, sortBy]);

  const sortedSearch = useMemo(() => {
    if (sortBy === "title_asc") return [...filteredResults].sort((a, b) => a.title.localeCompare(b.title));
    if (sortBy === "title_desc") return [...filteredResults].sort((a, b) => b.title.localeCompare(a.title));
    return [...filteredResults].sort((a, b) => {
      const pa = songMetaMap.get(a.song_id)?.popularity ?? 0;
      const pb = songMetaMap.get(b.song_id)?.popularity ?? 0;
      return pb - pa || a.title.localeCompare(b.title);
    });
  }, [filteredResults, sortBy, songMetaMap]);

  // Reset visible count when filters, sort, or hide-my-songs toggle change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [matchesFilters, sortBy, hideMySongs]);

  // Infinite scroll observer
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, sortedBrowse.length));
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [sortedBrowse.length]);

  async function handlePendingAdd(songId: string, slug?: string | null) {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = slug ? `/songs/${slug}` : "/search";
      router.push(`/auth?next=${encodeURIComponent(next)}`);
      return;
    }
    setPendingAddId(songId);
  }

  async function addSong(songId: string, level: string) {
    setPendingAddId(null);
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) { router.push("/auth"); return; }
    const { error } = await supabase.from("user_songs").upsert(
      { user_id: session.user.id, song_id: songId, confidence: level, updated_at: new Date().toISOString() },
      { onConflict: "user_id,song_id" }
    );
    if (error) {
      setStatus(error.message);
    } else {
      setRepertoire((prev) => new Map(prev).set(songId, level));
    }
  }

  const visibleSongs = sortedBrowse.slice(0, visibleCount);
  const searching = q.trim().length > 0;

  return (
    <div className="space-y-3">
      {/* Search box */}
      <div className="rounded-2xl border border-zinc-200 p-5 shadow-sm space-y-3">
        <div>
          <input
            className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title, first line, recording artist, or composer"
          />
        </div>
        <div className="text-xs text-zinc-500">
          {loading
            ? "Searching…"
            : q.trim()
              ? `${sortedSearch.length} song(s)${activeFilterCount > 0 && sortedSearch.length < results.length ? ` (${results.length} before filters)` : ""}`
              : null}
        </div>
        {(searchError ?? status) ? <div className="text-sm text-zinc-700">{searchError ?? status}</div> : null}
      </div>

      {/* Filter bar */}
      <div className="space-y-2">
        <div className="flex flex-col gap-2 px-1">
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
            {currentUser && repertoire.size > 0 && !searching && (
              <label className="h-7 flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-500 cursor-pointer select-none hover:bg-zinc-50 transition-colors whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={hideMySongs}
                  onChange={(e) => setHideMySongs(e.target.checked)}
                  className="rounded border-zinc-300 accent-amber-500"
                />
                Hide my songs
              </label>
            )}
          </div>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
            {searching ? null : songsLoading ? null : `${sortedBrowse.length} song${sortedBrowse.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {filtersOpen && (
          <FilterPanel
            filterOptions={filterOptions}
            selectedGenres={selectedGenres}
            selectedLanguages={selectedLanguages}
            selectedThemes={selectedThemes}
            selectedVibe={selectedVibe}
            setSelectedVibe={setSelectedVibe}
            selectedTonality={selectedTonality}
            setSelectedTonality={setSelectedTonality}
            selectedMeter={selectedMeter}
            setSelectedMeter={setSelectedMeter}
            activeFilterCount={activeFilterCount}
            toggleGenre={toggleGenre}
            toggleLanguage={toggleLanguage}
            toggleTheme={toggleTheme}
            clearFilters={clearFilters}
          />
        )}

        {/* Song list: search results or browse list */}
        {searching ? (
          <div className="grid gap-2">
            {sortedSearch.map((r) => (
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
                popularity={songMetaMap.get(r.song_id)?.popularity}
                repertoire={repertoire}
                pendingAddId={pendingAddId}
                singingVoice={singingVoice}
                setPendingAddId={setPendingAddId}
                onAdd={handlePendingAdd}
                addSong={addSong}
              />
            ))}
            {!loading && sortedSearch.length === 0 ? (
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
                popularity={r.popularity}
                repertoire={repertoire}
                pendingAddId={pendingAddId}
                singingVoice={singingVoice}
                setPendingAddId={setPendingAddId}
                onAdd={handlePendingAdd}
                addSong={addSong}
              />
            ))}

            {visibleCount < sortedBrowse.length && (
              <div ref={sentinelRef} className="py-4 text-center text-xs text-zinc-400">
                Loading more…
              </div>
            )}
            {visibleCount >= sortedBrowse.length && sortedBrowse.length > PAGE_SIZE && (
              <div className="py-4 text-center text-xs text-zinc-400">
                All {sortedBrowse.length} songs shown
              </div>
            )}
            {sortedBrowse.length === 0 && (
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
  popularity,
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
  popularity?: number;
  repertoire: Map<string, string>;
  pendingAddId: string | null;
  singingVoice: string | null;
  setPendingAddId: (id: string | null) => void;
  onAdd: (id: string, slug?: string | null) => void | Promise<void>;
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
      {(genres.length > 0 || (popularity ?? 0) > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {[...genres].sort().map((g) => (
            <span key={g} className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-500">
              {g}
            </span>
          ))}
          {(popularity ?? 0) > 0 && (
            <span className="text-xs text-zinc-400">{popularity} {popularity === 1 ? "jammer" : "jammers"}</span>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Link href={href} className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50">
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
          <button
            className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50"
            onClick={() => onAdd(songId, slug)}
          >
            {inRepertoire ? "Update" : "Add"}
          </button>
        )}
      </div>
    </div>
  );
}
