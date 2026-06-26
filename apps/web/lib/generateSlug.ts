export function generateSlug(title: string, composerNames: string[], culture?: string): string {
  const seen = new Set<string>();
  const uniqueNames = composerNames.filter(n => {
    const key = n.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const parts = [title, ...uniqueNames];
  if (culture) parts.push(culture);
  return parts
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}
