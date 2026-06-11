"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatComposers } from "@/lib/formatComposers";
import { matchesSearch } from "@/lib/normalizeSearch";
import SubmitSongForm from "@/components/SubmitSongForm";
import { useSongFilters } from "@/hooks/useSongFilters";
import { useScrollRestoration } from "@/hooks/useScrollRestoration";
import { useSongSearch, type SongSearchResult } from "@/hooks/useSongSearch";
import { sortRepertoireSearchResults } from "@/lib/sortRepertoireSearchResults";
import { SortDropdown } from "@/components/SortDropdown";
import { FilterPanel } from "@/components/FilterPanel";
import SongCard from "@/components/SongCard";
import AddToSetPanel from "@/components/AddToSetPanel";

const CONFIDENCE_LEVELS = [
  { key: "lead", label: "Lead" },
  { key: "support", label: "Support" },
  { key: "learn", label: "Learn" },
] as const;

type ConfidenceKey = (typeof CONFIDENCE_LEVELS)[number]["key"];

const SORT_OPTIONS = [
  { value: "title_asc" as const, label: "A → Z" },
  { value: "title_desc" as const, label: "Z → A" },
  { value: "popularity" as const, label: "Popular" },
];

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

type SuggestionResult = {
  song_id: string;
  title: string;
  display_artist: string | null;
  first_line: string | null;
  slug: string | null;
  composers: string[];
  cultures: string[];
  productions: string[];
  genres: string[];
  languages: string[];
  year: number | null;
  popularity: number;
  youtube_id: string | null;
  spotify_track_id: string | null;
};

type AddableSong = {
  slug: string | null;
  title: string;
  display_artist: string | null;
  first_line: string | null;
  composers: string[];
  cultures: string[];
  productions: string[];
  genres: string[];
  languages: string[] | null;
};


function SuggestionsPanel({
  suggestions,
  pendingAddId,
  setPendingAddId,
  singingVoice,
  onAddSong,
  onVoiceUpdated,
  onLoadMore,
  hasMore,
  loadingMore,
}: {
  suggestions: SuggestionResult[];
  pendingAddId: string | null;
  setPendingAddId: (id: string | null) => void;
  singingVoice: string | null;
  onAddSong: (songId: string, level: string, suggestion: SuggestionResult) => void;
  onVoiceUpdated: (voice: string) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  loadingMore: boolean;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onLoadMore(); },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore]);

  return (
    <div>
      <p className="px-1 text-sm font-medium text-zinc-500">Songs you might know</p>
      <div className="mt-2 grid gap-2">
        {suggestions.map((s) => (
          <SongCard
            key={s.song_id}
            songId={s.song_id}
            slug={s.slug}
            title={s.title}
            displayArtist={s.display_artist}
            composers={s.composers}
            cultures={s.cultures}
            productions={s.productions}
            year={s.year}
            aka={null}
            genres={s.genres}
            languages={s.languages}
            popularity={s.popularity}
            youtubeId={s.youtube_id}
            spotifyTrackId={s.spotify_track_id}
            repertoire={new Map()}
            pendingAddId={pendingAddId}
            singingVoice={singingVoice}
            setPendingAddId={setPendingAddId}
            onAdd={(songId) => setPendingAddId(songId)}
            addSong={(songId, level) => onAddSong(songId, level, s)}
            onVoiceUpdated={onVoiceUpdated}
          />
        ))}
        {hasMore && (
          <div ref={sentinelRef} className="p-3 text-center text-xs text-zinc-400">
            {loadingMore ? "Loading…" : ""}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RepertoirePage() {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);
  const [singingVoice, setSingingVoice] = useState<string | null>(null);

  const [items, setItems] = useState<Item[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionResult[]>([]);
  const [suggestionsOffset, setSuggestionsOffset] = useState(0);
  const [suggestionsHasMore, setSuggestionsHasMore] = useState(true);
  const [suggestionsLoadingMore, setSuggestionsLoadingMore] = useState(false);
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRemoveConfirm, setBulkRemoveConfirm] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);
  const [bulkSetId, setBulkSetId] = useState("");
  const [bulkConfidenceLevel, setBulkConfidenceLevel] = useState("");
  const [newSetName, setNewSetName] = useState("");
  const [songSetMemberships, setSongSetMemberships] = useState<Record<string, Set<string>>>({});
  const [bulkCreatingSet, setBulkCreatingSet] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const loadingMoreRef = useRef(false);
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

  const saveScrollPosition = useScrollRestoration("scroll:/repertoire", !loading);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!data.session) {
          setIsSignedIn(false);
          setLoading(false);
          return;
        }
        setIsSignedIn(true);

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

        const [{ data: p }, rows, popularityRes, setsJson, suggestionsRes] = await Promise.all([
          supabase.from("profiles").select("singing_voice").eq("id", uid).single(),
          fetchAllUserSongs(),
          supabase.rpc("song_popularity_counts"),
          fetch("/api/sets").then((r) => (r.ok ? r.json() : { owned: [], collaborating: [] })),
          supabase.rpc("suggest_songs_for_user", { p_user_id: uid, p_limit: 20 }),
        ]);

        setSingingVoice((p as any)?.singing_voice ?? null);
        setUserSets([...(setsJson.owned ?? []), ...(setsJson.collaborating ?? [])]);
        const initialSuggestions = (suggestionsRes.data ?? []) as SuggestionResult[];
        setSuggestions(initialSuggestions);
        setSuggestionsOffset(initialSuggestions.length);
        setSuggestionsHasMore(initialSuggestions.length === 20);

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

  const sortedSearchResults = useMemo(
    () => searching
      ? sortRepertoireSearchResults(searchResults, new Set(repertoireMap.keys()))
      : searchResults,
    [searchResults, repertoireMap, searching]
  );

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

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    const visibleIds = sortedFiltered.map((it) => it.song_id);
    const someSelected = visibleIds.some((id) => selectedIds.has(id));
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
    el.indeterminate = someSelected && !allSelected;
  }, [sortedFiltered, selectedIds]);

  function toggleSelect(songId: string) {
    setBulkRemoveConfirm(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return next;
    });
  }

  function toggleSelectAll() {
    setBulkRemoveConfirm(false);
    const visibleIds = sortedFiltered.map((it) => it.song_id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleIds));
    }
  }

  async function bulkAddToSet(setId: string) {
    const ids = Array.from(selectedIds);
    const set = userSets.find((s) => s.id === setId);
    setBulkSetId("");
    await Promise.all(
      ids.map((songId) =>
        fetch(`/api/sets/${setId}/songs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ songId }),
        })
      )
    );
    setBulkStatus(`Added to ${set?.name ?? "set"}`);
    setTimeout(() => setBulkStatus(null), 2500);
  }

  function bulkUpdateConfidence(level: string) {
    if (!userId) return;
    const ids = Array.from(selectedIds);
    setBulkConfidenceLevel("");
    setItems((cur) => cur.map((it) => (ids.includes(it.song_id) ? { ...it, confidence: level } : it)));
    startTransition(async () => {
      const { error } = await supabase
        .from("user_songs")
        .update({ confidence: level })
        .eq("user_id", userId)
        .in("song_id", ids);
      if (error) alert(error.message);
    });
  }

  function bulkRemove() {
    if (!userId) return;
    const ids = Array.from(selectedIds);
    const prevItems = items;
    setItems((prev) => prev.filter((x) => !ids.includes(x.song_id)));
    setBulkRemoveConfirm(false);
    startTransition(async () => {
      const { error } = await supabase
        .from("user_songs")
        .delete()
        .eq("user_id", userId)
        .in("song_id", ids);
      if (error) { alert(error.message); setItems(prevItems); }
    });
  }

  async function createSetAndBulkAdd(name: string) {
    const res = await fetch("/api/sets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) { alert("Failed to create set"); return; }
    const { id } = await res.json();
    setUserSets((prev) => [{ id, name }, ...prev]);
    setBulkCreatingSet(false);
    setNewSetName("");
    await bulkAddToSet(id);
  }

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
    const prevItems = items;
    setItems((prev) => prev.filter((x) => x.song_id !== song_id));
    startTransition(async () => {
      const { error } = await supabase
        .from("user_songs")
        .delete()
        .eq("user_id", userId)
        .eq("song_id", song_id);
      if (error) { alert(error.message); setItems(prevItems); }
    });
  };

  const addSong = (songId: string, confidence: string, result: AddableSong) => {
    if (!userId) return;
    const prevItems = items;
    const prevSuggestions = suggestions;
    setPendingAddId(null);
    setSuggestions((prev) => prev.filter((s) => s.song_id !== songId));
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
        languages: result.languages ?? [] as string[],
        themes: [],
        vibe: null,
        tonality: null,
        meter: null,
        year: null,
      };
      return [...prev, newItem].sort((a, b) => a.title.localeCompare(b.title));
    });
    startTransition(async () => {
      const { error } = await supabase.from("user_songs").upsert(
        { user_id: userId, song_id: songId, confidence, updated_at: new Date().toISOString() },
        { onConflict: "user_id,song_id" }
      );
      if (error) {
        alert(error.message);
        setItems(prevItems);
        setSuggestions(prevSuggestions);
      }
    });
  };

  async function loadSetMemberships(songId: string) {
    if (songSetMemberships[songId] !== undefined) return;
    const { data } = await supabase.from("set_songs").select("set_id").eq("song_id", songId);
    if (data) {
      setSongSetMemberships((prev) => ({ ...prev, [songId]: new Set(data.map((r: any) => r.set_id)) }));
    }
  }

  const loadMoreSuggestions = useCallback(async () => {
    if (!suggestionsHasMore || loadingMoreRef.current || !userId) return;
    loadingMoreRef.current = true;
    setSuggestionsLoadingMore(true);
    const { data } = await supabase.rpc("suggest_songs_for_user", {
      p_user_id: userId,
      p_limit: 20,
      p_offset: suggestionsOffset,
    });
    if (data) {
      const page = data as SuggestionResult[];
      setSuggestions((prev) => {
        const seen = new Set(prev.map((s) => s.song_id));
        return [...prev, ...page.filter((s) => !seen.has(s.song_id))];
      });
      setSuggestionsOffset((prev) => prev + page.length);
      setSuggestionsHasMore(page.length === 20);
    }
    loadingMoreRef.current = false;
    setSuggestionsLoadingMore(false);
  }, [suggestionsHasMore, userId, suggestionsOffset, supabase]);

  if (!loading && isSignedIn === false) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">My Repertoire</h1>
          <p className="mt-1 text-sm text-zinc-500">Every song you know or want to learn.</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="text-base font-semibold text-zinc-900">Track the songs you know</p>
          <p className="mt-2 text-sm text-zinc-500">
            Add songs to your repertoire — as a lead, support, or something you&apos;re learning — and SingJam will match you with musicians who share your songs.
          </p>
          <Link href="/auth" className="mt-4 inline-block text-sm font-medium text-amber-600 hover:text-amber-500">
            Sign in →
          </Link>
        </div>
      </div>
    );
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
            {searchLoading ? "Searching…" : `${sortedSearchResults.length} result${sortedSearchResults.length === 1 ? "" : "s"}`}
          </div>
          <div className="grid gap-2">
            {!searchLoading && sortedSearchResults.length === 0 ? (
              <div className="rounded-md border p-4 text-sm text-muted-foreground">No songs found.</div>
            ) : (
              sortedSearchResults.map((result) => {
                const inRep = repertoireMap.get(result.song_id);
                const isPicking = pendingAddId === result.song_id;
                const href = `/songs/${result.slug ?? result.song_id}`;

                if (!inRep) {
                  return (
                    <SongCard
                      key={result.song_id}
                      songId={result.song_id}
                      slug={result.slug}
                      title={result.title}
                      displayArtist={result.display_artist}
                      composers={result.composers}
                      cultures={result.cultures ?? []}
                      productions={result.productions}
                      year={result.year}
                      aka={result.aka}
                      genres={result.genres}
                      languages={result.languages ?? []}
                      youtubeId={result.youtube_id}
                      spotifyTrackId={result.spotify_track_id}
                      repertoire={new Map()}
                      pendingAddId={pendingAddId}
                      singingVoice={singingVoice}
                      setPendingAddId={setPendingAddId}
                      onAdd={(songId) => setPendingAddId(songId)}
                      addSong={(songId, level) => addSong(songId, level, result)}
                      onVoiceUpdated={(voice) => setSingingVoice(voice)}
                    />
                  );
                }

                return (
                  <div key={result.song_id} className="rounded-md border flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
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

                    <div className="relative flex flex-wrap items-center gap-2 sm:shrink-0">
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
                            <AddToSetPanel
                              songId={result.song_id}
                              sets={userSets}
                              inSets={songSetMemberships[result.song_id]}
                              onOpen={() => loadSetMemberships(result.song_id)}
                              onAdded={(setId) => setSongSetMemberships((prev) => ({ ...prev, [result.song_id]: new Set([...(prev[result.song_id] ?? []), setId]) }))}
                              onSetCreated={(s) => setUserSets((prev) => [s, ...prev])}
                            />
                          )}
                          <Link href={href} className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 transition-colors">
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
                          <Link href={href} className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 transition-colors">
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
        <>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
            <p className="text-base font-semibold text-zinc-900">Your repertoire is empty</p>
            <p className="mt-1 text-sm text-zinc-500">Add songs you know and SingJam will match you with musicians who share your repertoire.</p>
            <p className="mt-3 text-sm text-zinc-400">Search for a song above, or pick one from the suggestions below.</p>
          </div>
          {suggestions.length > 0 && (
            <SuggestionsPanel
              suggestions={suggestions}
              pendingAddId={pendingAddId}
              setPendingAddId={setPendingAddId}
              singingVoice={singingVoice}
              onAddSong={(songId, level, suggestion) => addSong(songId, level, suggestion)}
              onVoiceUpdated={(voice) => setSingingVoice(voice)}
              onLoadMore={loadMoreSuggestions}
              hasMore={suggestionsHasMore}
              loadingMore={suggestionsLoadingMore}
            />
          )}
        </>
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

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <span className="text-sm font-medium text-amber-800">
                {selectedIds.size} selected
              </span>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-amber-700 underline underline-offset-2"
              >
                Deselect all
              </button>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {bulkStatus ? (
                  <span className="text-xs text-green-700">{bulkStatus}</span>
                ) : null}
                {userSets.length > 0 && (
                  bulkCreatingSet ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={newSetName}
                        onChange={(e) => setNewSetName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newSetName.trim()) createSetAndBulkAdd(newSetName.trim());
                          if (e.key === "Escape") { setBulkCreatingSet(false); setNewSetName(""); }
                        }}
                        placeholder="Set name…"
                        autoFocus
                        className="w-28 rounded-xl border border-zinc-300 px-2 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
                      />
                      <button
                        onClick={() => { if (newSetName.trim()) createSetAndBulkAdd(newSetName.trim()); }}
                        disabled={!newSetName.trim()}
                        className="rounded-xl border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-40"
                      >
                        Create
                      </button>
                      <button
                        onClick={() => { setBulkCreatingSet(false); setNewSetName(""); }}
                        className="text-zinc-400 hover:text-zinc-600 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <select
                      value={bulkSetId}
                      onChange={(e) => {
                        if (e.target.value === "__new__") { setBulkCreatingSet(true); setBulkSetId(""); }
                        else if (e.target.value) bulkAddToSet(e.target.value);
                      }}
                      className="rounded-xl border border-zinc-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">Add to set…</option>
                      {userSets.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                      <option value="__new__">+ New set…</option>
                    </select>
                  )
                )}
                <select
                  value={bulkConfidenceLevel}
                  onChange={(e) => { if (e.target.value) bulkUpdateConfidence(e.target.value); }}
                  className="rounded-xl border border-zinc-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Change role…</option>
                  {CONFIDENCE_LEVELS.map((l) => (
                    <option
                      key={l.key}
                      value={l.key}
                      disabled={l.key === "lead" && (!singingVoice || singingVoice === "none")}
                    >
                      {l.label}
                    </option>
                  ))}
                </select>
                {bulkRemoveConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-700">
                      Remove {selectedIds.size} song{selectedIds.size === 1 ? "" : "s"}?
                    </span>
                    <button
                      onClick={bulkRemove}
                      className="rounded-xl border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setBulkRemoveConfirm(false)}
                      className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setBulkRemoveConfirm(true)}
                    className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs text-zinc-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          )}

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
              <>
                <div className="flex items-center gap-3 bg-zinc-50 px-4 py-2">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={sortedFiltered.length > 0 && sortedFiltered.every((it) => selectedIds.has(it.song_id))}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 cursor-pointer rounded border-zinc-300 accent-amber-500"
                    aria-label="Select all"
                  />
                  <span className="text-xs text-zinc-400">Select all</span>
                </div>
                {sortedFiltered.map((it) => (
                <div
                  key={it.song_id}
                  className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between transition-colors ${
                    selectedIds.has(it.song_id) ? "bg-amber-50/60" : ""
                  }`}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(it.song_id)}
                      onChange={() => toggleSelect(it.song_id)}
                      className="mt-1 h-4 w-4 flex-shrink-0 cursor-pointer rounded border-zinc-300 accent-amber-500"
                      aria-label={`Select ${it.title}`}
                    />
                    <div className="min-w-0">
                    <div className="truncate font-medium">
                      <Link href={`/songs/${it.slug ?? it.song_id}`} onClick={() => saveScrollPosition()} className="hover:text-amber-600">
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
                  </div>

                  <div className="relative flex flex-wrap items-center gap-2 sm:shrink-0">
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
                      <AddToSetPanel
                        songId={it.song_id}
                        sets={userSets}
                        inSets={songSetMemberships[it.song_id]}
                        onOpen={() => loadSetMemberships(it.song_id)}
                        onAdded={(setId) => setSongSetMemberships((prev) => ({ ...prev, [it.song_id]: new Set([...(prev[it.song_id] ?? []), setId]) }))}
                        onSetCreated={(s) => setUserSets((prev) => [s, ...prev])}
                      />
                    )}

                    <Link
                      href={`/songs/${it.slug ?? it.song_id}`}
                      onClick={() => saveScrollPosition()}
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
              ))}
              </>
            )}
          </div>

          {suggestions.length > 0 && (
            <SuggestionsPanel
              suggestions={suggestions}
              pendingAddId={pendingAddId}
              setPendingAddId={setPendingAddId}
              singingVoice={singingVoice}
              onAddSong={(songId, level, suggestion) => addSong(songId, level, suggestion)}
              onVoiceUpdated={(voice) => setSingingVoice(voice)}
              onLoadMore={loadMoreSuggestions}
              hasMore={suggestionsHasMore}
              loadingMore={suggestionsLoadingMore}
            />
          )}
        </>
      )}
    </div>
  );
}
