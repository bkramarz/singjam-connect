import { useCallback, useEffect, useMemo, useState } from "react";

type FilterableSong = {
  genres: string[];
  languages: string[];
  themes: string[];
  cultures: string[];
  vibe: string | null;
  tonality: string | null;
  meter: string | null;
  year: number | null;
};

export type SortBy = "popularity" | "title_asc" | "title_desc";

function readUrlParams() {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

export function useSongFilters<T extends FilterableSong>(
  songs: T[],
  initialSortBy: SortBy = "popularity"
) {
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(() => new Set(readUrlParams().getAll("genre")));
  const [selectedLanguages, setSelectedLanguages] = useState<Set<string>>(() => new Set(readUrlParams().getAll("lang")));
  const [selectedThemes, setSelectedThemes] = useState<Set<string>>(() => new Set(readUrlParams().getAll("theme")));
  const [selectedCultures, setSelectedCultures] = useState<Set<string>>(() => new Set(readUrlParams().getAll("culture")));
  const [selectedVibe, setSelectedVibe] = useState(() => readUrlParams().get("vibe") ?? "");
  const [selectedTonality, setSelectedTonality] = useState(() => readUrlParams().get("tonality") ?? "");
  const [selectedMeter, setSelectedMeter] = useState(() => readUrlParams().get("meter") ?? "");
  const [yearMin, setYearMin] = useState(() => readUrlParams().get("yrMin") ?? "");
  const [yearMax, setYearMax] = useState(() => readUrlParams().get("yrMax") ?? "");
  const [sortBy, setSortBy] = useState<SortBy>(() => (readUrlParams().get("sort") as SortBy | null) ?? initialSortBy);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    ["genre", "lang", "theme", "culture", "vibe", "tonality", "meter", "sort", "yrMin", "yrMax"].forEach((k) => params.delete(k));
    selectedGenres.forEach((g) => params.append("genre", g));
    selectedLanguages.forEach((l) => params.append("lang", l));
    selectedThemes.forEach((t) => params.append("theme", t));
    selectedCultures.forEach((c) => params.append("culture", c));
    if (selectedVibe) params.set("vibe", selectedVibe);
    if (selectedTonality) params.set("tonality", selectedTonality);
    if (selectedMeter) params.set("meter", selectedMeter);
    if (yearMin) params.set("yrMin", yearMin);
    if (yearMax) params.set("yrMax", yearMax);
    if (sortBy !== initialSortBy) params.set("sort", sortBy);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [selectedGenres, selectedLanguages, selectedThemes, selectedCultures, selectedVibe, selectedTonality, selectedMeter, yearMin, yearMax, sortBy, initialSortBy]);

  const filterOptions = useMemo(() => {
    // For each dimension, derive available options from songs that pass all OTHER active filters.
    // This makes the filter pills cascade — selecting "Rock" trims languages/themes to Rock songs only.
    // Selected values are always included so they remain visible and deselectable.
    function matchesExcluding(song: FilterableSong, exclude: string): boolean {
      if (exclude !== "genres" && selectedGenres.size > 0 && !song.genres.some((g) => selectedGenres.has(g))) return false;
      if (exclude !== "languages" && selectedLanguages.size > 0 && !song.languages.some((l) => selectedLanguages.has(l))) return false;
      if (exclude !== "themes" && selectedThemes.size > 0 && !song.themes.some((t) => selectedThemes.has(t))) return false;
      if (exclude !== "cultures" && selectedCultures.size > 0 && !song.cultures.some((c) => selectedCultures.has(c))) return false;
      if (exclude !== "vibe" && selectedVibe && song.vibe !== selectedVibe) return false;
      if (exclude !== "tonality" && selectedTonality && !song.tonality?.split(/,\s*/).includes(selectedTonality)) return false;
      if (exclude !== "meter" && selectedMeter && song.meter !== selectedMeter) return false;
      if (exclude !== "year" && (yearMin || yearMax)) {
        if (song.year === null) return false;
        if (yearMin && song.year < parseInt(yearMin, 10)) return false;
        if (yearMax && song.year > parseInt(yearMax, 10)) return false;
      }
      return true;
    }

    return {
      genres: Array.from(new Set([...songs.filter((s) => matchesExcluding(s, "genres")).flatMap((s) => s.genres), ...selectedGenres])).sort(),
      languages: Array.from(new Set([...songs.filter((s) => matchesExcluding(s, "languages")).flatMap((s) => s.languages), ...selectedLanguages])).sort(),
      themes: Array.from(new Set([...songs.filter((s) => matchesExcluding(s, "themes")).flatMap((s) => s.themes), ...selectedThemes])).sort(),
      cultures: Array.from(new Set([...songs.filter((s) => matchesExcluding(s, "cultures")).flatMap((s) => s.cultures), ...selectedCultures])).sort(),
      vibes: Array.from(new Set(songs.filter((s) => matchesExcluding(s, "vibe")).map((s) => s.vibe).filter(Boolean) as string[])).sort(),
      tonalities: Array.from(new Set(songs.filter((s) => matchesExcluding(s, "tonality")).flatMap((s) => s.tonality ? s.tonality.split(/,\s*/) : []))).sort(),
      meters: Array.from(new Set(songs.filter((s) => matchesExcluding(s, "meter")).map((s) => s.meter).filter(Boolean) as string[])).sort(),
    };
  }, [songs, selectedGenres, selectedLanguages, selectedThemes, selectedCultures, selectedVibe, selectedTonality, selectedMeter, yearMin, yearMax]);

  const yearBounds = useMemo(() => {
    const years = songs.map((s) => s.year).filter((y): y is number => y !== null);
    if (years.length === 0) return null;
    return { min: Math.min(...years), max: Math.max(...years) };
  }, [songs]);

  const activeFilterCount =
    selectedGenres.size +
    selectedLanguages.size +
    selectedThemes.size +
    selectedCultures.size +
    (selectedVibe ? 1 : 0) +
    (selectedTonality ? 1 : 0) +
    (selectedMeter ? 1 : 0) +
    (yearMin ? 1 : 0) +
    (yearMax ? 1 : 0);

  const matchesFilters = useCallback((song: FilterableSong | undefined): boolean => {
    if (!song) return true;
    if (selectedGenres.size > 0 && !song.genres.some((g) => selectedGenres.has(g))) return false;
    if (selectedLanguages.size > 0 && !song.languages.some((l) => selectedLanguages.has(l))) return false;
    if (selectedThemes.size > 0 && !song.themes.some((t) => selectedThemes.has(t))) return false;
    if (selectedCultures.size > 0 && !song.cultures.some((c) => selectedCultures.has(c))) return false;
    if (selectedVibe && song.vibe !== selectedVibe) return false;
    if (selectedTonality && !song.tonality?.split(/,\s*/).includes(selectedTonality)) return false;
    if (selectedMeter && song.meter !== selectedMeter) return false;
    if (yearMin || yearMax) {
      if (song.year === null) return false;
      if (yearMin && song.year < parseInt(yearMin, 10)) return false;
      if (yearMax && song.year > parseInt(yearMax, 10)) return false;
    }
    return true;
  }, [selectedGenres, selectedLanguages, selectedThemes, selectedCultures, selectedVibe, selectedTonality, selectedMeter, yearMin, yearMax]);

  function toggleGenre(g: string) {
    setSelectedGenres((prev) => { const next = new Set(prev); next.has(g) ? next.delete(g) : next.add(g); return next; });
  }
  function toggleLanguage(l: string) {
    setSelectedLanguages((prev) => { const next = new Set(prev); next.has(l) ? next.delete(l) : next.add(l); return next; });
  }
  function toggleTheme(t: string) {
    setSelectedThemes((prev) => { const next = new Set(prev); next.has(t) ? next.delete(t) : next.add(t); return next; });
  }
  function toggleCulture(c: string) {
    setSelectedCultures((prev) => { const next = new Set(prev); next.has(c) ? next.delete(c) : next.add(c); return next; });
  }
  function clearFilters() {
    setSelectedGenres(new Set());
    setSelectedLanguages(new Set());
    setSelectedThemes(new Set());
    setSelectedCultures(new Set());
    setSelectedVibe("");
    setSelectedTonality("");
    setSelectedMeter("");
    setYearMin("");
    setYearMax("");
  }

  return {
    selectedGenres, selectedLanguages, selectedThemes, selectedCultures,
    selectedVibe, setSelectedVibe,
    selectedTonality, setSelectedTonality,
    selectedMeter, setSelectedMeter,
    yearMin, setYearMin,
    yearMax, setYearMax,
    yearBounds,
    activeFilterCount,
    filterOptions,
    matchesFilters,
    toggleGenre, toggleLanguage, toggleTheme, toggleCulture, clearFilters,
    sortBy, setSortBy,
  };
}
