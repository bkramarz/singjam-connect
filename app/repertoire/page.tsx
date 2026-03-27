"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatComposers } from "@/lib/formatComposers";
import { matchesSearch } from "@/lib/normalizeSearch";

const CONFIDENCE_LEVELS = [
  { key: "lead", label: "Lead" },
  { key: "support", label: "Support" },
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
};

export default function RepertoirePage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [singingVoice, setSingingVoice] = useState<string | null>(null);

  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [confidenceFilter, setConfidenceFilter] = useState<string>("all");

  // Filter state
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [selectedLanguages, setSelectedLanguages] = useState<Set<string>>(new Set());
  const [selectedThemes, setSelectedThemes] = useState<Set<string>>(new Set());
  const [selectedVibe, setSelectedVibe] = useState("");
  const [selectedTonality, setSelectedTonality] = useState("");
  const [selectedMeter, setSelectedMeter] = useState("");

  const [isPending, startTransition] = useTransition();

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

        supabase.from("profiles").select("singing_voice").eq("id", uid).single()
          .then(({ data: p }) => setSingingVoice((p as any)?.singing_voice ?? null));

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
              first_line,
              hook,
              notes,
              vibe,
              tonality,
              meter,
              song_composers ( people ( name ) ),
              song_lyricists ( people ( name ) ),
              song_cultures ( cultures ( name ) ),
              song_productions ( productions ( name ) ),
              song_genres ( genres ( name ) ),
              song_languages ( languages ( name ) ),
              song_themes ( themes ( name ) )
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

        const typed = (rows ?? []) as any[];
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
              composers: [...names].sort(),
              cultures: (r.songs.song_cultures ?? []).map((c: any) => c.cultures?.name).filter(Boolean),
              productions: (r.songs.song_productions ?? []).map((p: any) => p.productions?.name).filter(Boolean),
              genres: (r.songs.song_genres ?? []).map((g: any) => g.genres?.name).filter(Boolean),
              languages: (r.songs.song_languages ?? []).map((l: any) => l.languages?.name).filter(Boolean),
              themes: (r.songs.song_themes ?? []).map((t: any) => t.themes?.name).filter(Boolean),
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

  // Derive filter options from loaded items
  const filterOptions = useMemo(() => {
    const genres = Array.from(new Set(items.flatMap((i) => i.genres))).sort();
    const languages = Array.from(new Set(items.flatMap((i) => i.languages))).sort();
    const themes = Array.from(new Set(items.flatMap((i) => i.themes))).sort();
    const vibes = Array.from(new Set(items.map((i) => i.vibe).filter(Boolean) as string[])).sort();
    const tonalities = Array.from(new Set(items.flatMap((i) => i.tonality ? i.tonality.split(/,\s*/) : []))).sort();
    const meters = Array.from(new Set(items.map((i) => i.meter).filter(Boolean) as string[])).sort();
    return { genres, languages, themes, vibes, tonalities, meters };
  }, [items]);

  const activeFilterCount =
    selectedGenres.size +
    selectedLanguages.size +
    selectedThemes.size +
    (selectedVibe ? 1 : 0) +
    (selectedTonality ? 1 : 0) +
    (selectedMeter ? 1 : 0);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (confidenceFilter !== "all" && (it.confidence ?? "") !== confidenceFilter) return false;
      if (selectedGenres.size > 0 && !it.genres.some((g) => selectedGenres.has(g))) return false;
      if (selectedLanguages.size > 0 && !it.languages.some((l) => selectedLanguages.has(l))) return false;
      if (selectedThemes.size > 0 && !it.themes.some((t) => selectedThemes.has(t))) return false;
      if (selectedVibe && it.vibe !== selectedVibe) return false;
      if (selectedTonality && !it.tonality?.split(/,\s*/).includes(selectedTonality)) return false;
      if (selectedMeter && it.meter !== selectedMeter) return false;
      const hay = [it.title, it.display_artist ?? "", ...it.composers, ...it.productions, it.first_line ?? "", it.hook ?? "", it.notes ?? ""].join(" ");
      return matchesSearch(hay, query);
    });
  }, [items, query, confidenceFilter, selectedGenres, selectedLanguages, selectedThemes, selectedVibe, selectedTonality, selectedMeter]);

  const confidenceLabel = (key: string | null) => {
    if (!key) return "Unrated";
    return CONFIDENCE_LEVELS.find((l) => l.key === key)?.label ?? key;
  };

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

  function toggleGenre(g: string) {
    setSelectedGenres((prev) => { const next = new Set(prev); next.has(g) ? next.delete(g) : next.add(g); return next; });
  }
  function toggleLanguage(l: string) {
    setSelectedLanguages((prev) => { const next = new Set(prev); next.has(l) ? next.delete(l) : next.add(l); return next; });
  }
  function toggleTheme(t: string) {
    setSelectedThemes((prev) => { const next = new Set(prev); next.has(t) ? next.delete(t) : next.add(t); return next; });
  }
  function clearFilters() {
    setSelectedGenres(new Set());
    setSelectedLanguages(new Set());
    setSelectedThemes(new Set());
    setSelectedVibe("");
    setSelectedTonality("");
    setSelectedMeter("");
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">My Repertoire</h1>
        <div className="mt-4 text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
          <div className="mt-1 text-muted-foreground">Add songs from the Song Library.</div>
          <Link
            href="/search"
            className="mt-3 inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Browse Songs
          </Link>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-zinc-200 p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Search</label>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by title, songwriter, or artist…"
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                />
              </div>

              <select
                value={confidenceFilter}
                onChange={(e) => setConfidenceFilter(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm sm:w-56"
              >
                <option value="all">All confidence</option>
                {CONFIDENCE_LEVELS.map((l) => (
                  <option key={l.key} value={l.key}>{l.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Filter bar */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {filtered.length} of {items.length}
            </div>
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
                          ({formatComposers(it.composers, it.cultures)})
                        </span>
                      )}
                    </div>
                    <div className="truncate text-sm text-muted-foreground">
                      {it.productions.length > 0
                        ? <>from <em>{it.productions.join(", ")}</em></>
                        : it.display_artist ?? "—"}
                    </div>

                  </div>

                  <div className="flex items-center gap-2 sm:shrink-0">
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
                          disabled={l.key === "lead" && singingVoice === "none"}
                        >
                          {l.key === "lead" && singingVoice === "none" ? "Lead (singers only)" : l.label}
                        </option>
                      ))}
                    </select>

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
