// Placement rule for the "mark as played" toggle, shared by web and native.
// Toggling a song moves it to sit just after the songs that are already
// played, so played songs stay grouped at the top of the set in play order.
// Callers assign their own `position` values afterwards (web is 0-based,
// native 1-based) — this helper only decides the order.
export function reorderSongsForPlayed<T extends { id: string; played?: boolean | null }>(
  songs: T[],
  id: string,
  played: boolean
): T[] {
  const entry = songs.find((s) => s.id === id);
  if (!entry) return songs;
  const rest = songs.filter((s) => s.id !== id);
  const insertAt = rest.filter((s) => s.played).length;
  const updated = { ...entry, played };
  return [...rest.slice(0, insertAt), updated, ...rest.slice(insertAt)];
}
