/**
 * Formats a jam's start time for display in emails and messages.
 * Pass the jam's stored timezone (e.g. "America/Los_Angeles") so the time
 * is shown in the host's local time rather than the server's UTC offset.
 * Falls back to UTC when timezone is null (e.g. jams created before this
 * field was added).
 */
export function formatJamTime(startsAt: string | null | undefined, timezone?: string | null): string | null {
  if (!startsAt) return null;
  return new Date(startsAt).toLocaleString("en-US", {
    timeZone: timezone ?? undefined,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Formats a jam's calendar date for share previews and other server-rendered
 * text. Pass the jam's stored timezone: it otherwise formats in the runtime's
 * own zone, which on the server is UTC, pushing an evening jam in the Americas
 * onto the following day.
 */
export function formatJamDate(startsAt: string | null | undefined, timezone?: string | null): string | null {
  if (!startsAt) return null;
  return new Date(startsAt).toLocaleDateString("en-US", {
    timeZone: timezone ?? undefined,
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
