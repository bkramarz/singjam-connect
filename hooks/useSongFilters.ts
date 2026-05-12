import { useCallback, useMemo, useState } from "react";

type FilterableSong = {
  genres: string[];
  languages: string[];
  themes: string[];
  vibe: string | null;
  tonality: string | null;
  meter: string | null;
};

export type SortBy = "popularity" | "title_asc" | "title_desc";

export function useSongFilters<T extends FilterableSong>(
  songs: T[],
  initialSortBy: SortBy = "popularity"
) {
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [selectedLanguages, setSelectedLanguages] = useState<Set<string>>(new Set());
  const [selectedThemes, setSelectedThemes] = useState<Set<string>>(new Set());
  const [selectedVibe, setSelectedVibe] = useState("");
  const [selectedTonality, setSelectedTonality] = useState("");
  const [selectedMeter, setSelectedMeter] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>(initialSortBy);

  const filterOptions = useMemo(() => ({
    genres: Array.from(new Set(songs.flatMap((s) => s.genres))).sort(),
    languages: Array.from(new Set(songs.flatMap((s) => s.languages))).sort(),
    themes: Array.from(new Set(songs.flatMap((s) => s.themes))).sort(),
    vibes: Array.from(new Set(songs.map((s) => s.vibe).filter(Boolean) as string[])).sort(),
    tonalities: Array.from(new Set(songs.flatMap((s) => s.tonality ? s.tonality.split(/,\s*/) : []))).sort(),
    meters: Array.from(new Set(songs.map((s) => s.meter).filter(Boolean) as string[])).sort(),
  }), [songs]);

  const activeFilterCount =
    selectedGenres.size +
    selectedLanguages.size +
    selectedThemes.size +
    (selectedVibe ? 1 : 0) +
    (selectedTonality ? 1 : 0) +
    (selectedMeter ? 1 : 0);

  const matchesFilters = useCallback((song: FilterableSong | undefined): boolean => {
    if (!song) return true;
    if (selectedGenres.size > 0 && !song.genres.some((g) => selectedGenres.has(g))) return false;
    if (selectedLanguages.size > 0 && !song.languages.some((l) => selectedLanguages.has(l))) return false;
    if (selectedThemes.size > 0 && !song.themes.some((t) => selectedThemes.has(t))) return false;
    if (selectedVibe && song.vibe !== selectedVibe) return false;
    if (selectedTonality && !song.tonality?.split(/,\s*/).includes(selectedTonality)) return false;
    if (selectedMeter && song.meter !== selectedMeter) return false;
    return true;
  }, [selectedGenres, selectedLanguages, selectedThemes, selectedVibe, selectedTonality, selectedMeter]);

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

  return {
    selectedGenres, selectedLanguages, selectedThemes,
    selectedVibe, setSelectedVibe,
    selectedTonality, setSelectedTonality,
    selectedMeter, setSelectedMeter,
    activeFilterCount,
    filterOptions,
    matchesFilters,
    toggleGenre, toggleLanguage, toggleTheme, clearFilters,
    sortBy, setSortBy,
  };
}
