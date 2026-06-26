export function sortRepertoireSearchResults<T extends { song_id: string }>(
  results: T[],
  repertoireIds: Set<string>
): T[] {
  return [...results].sort((a, b) => {
    const aIn = repertoireIds.has(a.song_id) ? 0 : 1;
    const bIn = repertoireIds.has(b.song_id) ? 0 : 1;
    return aIn - bIn;
  });
}
