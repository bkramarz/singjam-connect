// Merge a freshly-fetched page of song suggestions into the ones already
// shown, dropping any whose song_id is already present. The suggestion RPC
// paginates by offset, so overlapping rows can appear between pages (e.g. when
// a song is added to a repertoire mid-scroll and shifts the window); this keeps
// the rendered list free of duplicate keys. Shared by web and native.
export function mergeSuggestionsById<T extends { song_id: string }>(
  existing: T[],
  page: T[]
): T[] {
  const seen = new Set(existing.map((s) => s.song_id));
  return [...existing, ...page.filter((s) => !seen.has(s.song_id))];
}
