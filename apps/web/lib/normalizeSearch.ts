/** Strip everything except letters, digits, and spaces — matches the SQL search_songs normalization. */
export function normalizeSearch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "");
}

/**
 * Returns true if every word in the query appears somewhere in the haystack.
 * Both are normalized before comparison, matching the SQL search_songs behaviour.
 */
export function matchesSearch(haystack: string, query: string): boolean {
  const q = normalizeSearch(query.trim());
  if (!q) return true;
  const hay = normalizeSearch(haystack);
  return q.split(/\s+/).filter(Boolean).every((word) => hay.includes(word));
}
