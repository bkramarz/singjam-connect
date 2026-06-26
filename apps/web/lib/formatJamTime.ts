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
