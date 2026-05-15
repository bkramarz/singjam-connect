export function generateSlug(title: string, composerNames: string[], culture?: string): string {
  const parts = [title, ...composerNames];
  if (culture) parts.push(culture);
  return parts
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}
