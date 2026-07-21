// Shared song-filter logic for the extended (facet) filters used by both the web
// repertoire/songs pages and the native songs/repertoire screens. Keeping the
// predicate and option derivation here guarantees web and native filter songs
// identically. UI concerns (URL sync, React state, "hide my songs") stay in the
// individual apps.

export type FilterableSong = {
  genres: string[];
  languages: string[];
  themes: string[];
  cultures: string[];
  vibe: string | null;
  tonality: string | null;
  meter: string | null;
  year: number | null;
};

export type SongFilterState = {
  genres: Set<string>;
  languages: Set<string>;
  themes: Set<string>;
  cultures: Set<string>;
  vibe: string;
  tonality: string;
  meter: string;
  yearMin: string;
  yearMax: string;
};

export type FilterDim =
  | "genres"
  | "languages"
  | "themes"
  | "cultures"
  | "vibe"
  | "tonality"
  | "meter"
  | "year";

export type SongFilterOptions = {
  genres: string[];
  languages: string[];
  themes: string[];
  cultures: string[];
  vibes: string[];
  tonalities: string[];
  meters: string[];
};

// Returns true if `song` passes every active filter. Pass `exclude` to ignore one
// dimension — used when deriving that dimension's option list so the facets cascade
// (each dimension's options come from songs passing the OTHER active filters).
export function songMatchesFilters(
  song: FilterableSong,
  f: SongFilterState,
  exclude?: FilterDim
): boolean {
  if (exclude !== "genres" && f.genres.size > 0 && !song.genres.some((g) => f.genres.has(g))) return false;
  if (exclude !== "languages" && f.languages.size > 0 && !song.languages.some((l) => f.languages.has(l))) return false;
  if (exclude !== "themes" && f.themes.size > 0 && !song.themes.some((t) => f.themes.has(t))) return false;
  if (exclude !== "cultures" && f.cultures.size > 0 && !song.cultures.some((c) => f.cultures.has(c))) return false;
  if (exclude !== "vibe" && f.vibe && song.vibe !== f.vibe) return false;
  if (exclude !== "tonality" && f.tonality && !song.tonality?.split(/,\s*/).includes(f.tonality)) return false;
  if (exclude !== "meter" && f.meter && song.meter !== f.meter) return false;
  if (exclude !== "year" && (f.yearMin || f.yearMax)) {
    if (song.year === null) return false;
    if (f.yearMin && song.year < parseInt(f.yearMin, 10)) return false;
    if (f.yearMax && song.year > parseInt(f.yearMax, 10)) return false;
  }
  return true;
}

// Derives the available option list for every filter dimension. Each dimension is
// built from songs passing all OTHER active filters (so picking "Rock" trims the
// remaining facets to Rock songs). Currently-selected multi-select values are always
// included so their pills stay visible and deselectable even at zero matches.
export function deriveFilterOptions(
  songs: FilterableSong[],
  f: SongFilterState
): SongFilterOptions {
  const sortedUniq = (xs: string[]) => Array.from(new Set(xs)).sort();
  const forDim = (dim: FilterDim) => songs.filter((s) => songMatchesFilters(s, f, dim));
  return {
    genres: sortedUniq([...forDim("genres").flatMap((s) => s.genres), ...f.genres]),
    languages: sortedUniq([...forDim("languages").flatMap((s) => s.languages), ...f.languages]),
    themes: sortedUniq([...forDim("themes").flatMap((s) => s.themes), ...f.themes]),
    cultures: sortedUniq([...forDim("cultures").flatMap((s) => s.cultures), ...f.cultures]),
    vibes: sortedUniq(forDim("vibe").map((s) => s.vibe).filter(Boolean) as string[]),
    tonalities: sortedUniq(forDim("tonality").flatMap((s) => (s.tonality ? s.tonality.split(/,\s*/) : []))),
    meters: sortedUniq(forDim("meter").map((s) => s.meter).filter(Boolean) as string[]),
  };
}

// Counts how many filter dimensions are active. A year range (either bound) counts
// as one. Does not count app-specific toggles such as native's "hide my songs".
export function countActiveFilters(f: SongFilterState): number {
  return (
    f.genres.size +
    f.languages.size +
    f.themes.size +
    f.cultures.size +
    (f.vibe ? 1 : 0) +
    (f.tonality ? 1 : 0) +
    (f.meter ? 1 : 0) +
    (f.yearMin || f.yearMax ? 1 : 0)
  );
}
