export function jamCancelledHtml({
  name,
  jamName,
  startsAt,
  isHost = false,
}: {
  name?: string | null;
  jamName?: string | null;
  startsAt?: string | null;
  isHost?: boolean;
}) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const dateStr = startsAt
    ? new Date(startsAt).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

  if (isHost) {
    return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#18181b;padding:32px 16px">
  <h1 style="font-size:22px;font-weight:700;margin-bottom:8px">Jam cancelled</h1>
  <p style="font-size:15px;line-height:1.6;color:#52525b">
    ${greeting} Your jam <strong>${jamName ?? "your jam"}</strong>${dateStr ? ` on ${dateStr}` : ""} has been cancelled. All attendees have been notified.
  </p>
  <a href="https://singjam.org/jams"
     style="display:inline-block;margin-top:24px;background-color:#f59e0b;color:#fff;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none">
    Browse other jams
  </a>
  <p style="margin-top:32px;font-size:13px;color:#a1a1aa">SingJam · Find your jam partner</p>
</body>
</html>`;
  }

  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#18181b;padding:32px 16px">
  <h1 style="font-size:22px;font-weight:700;margin-bottom:8px">Jam cancelled</h1>
  <p style="font-size:15px;line-height:1.6;color:#52525b">
    ${greeting} Unfortunately, <strong>${jamName ?? "a jam you were attending"}</strong>${dateStr ? ` on ${dateStr}` : ""} has been cancelled by the host.
  </p>
  <p style="font-size:15px;line-height:1.6;color:#52525b;margin-top:16px">
    We hope to see you at another jam soon.
  </p>
  <a href="https://singjam.org/jams"
     style="display:inline-block;margin-top:24px;background-color:#f59e0b;color:#fff;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none">
    Browse other jams
  </a>
  <p style="margin-top:32px;font-size:13px;color:#a1a1aa">SingJam · Find your jam partner</p>
</body>
</html>`;
}
