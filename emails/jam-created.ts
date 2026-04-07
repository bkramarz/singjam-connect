export function jamCreatedHtml({
  name,
  jamName,
  jamUrl,
  startsAt,
}: {
  name?: string | null;
  jamName?: string | null;
  jamUrl: string;
  startsAt?: string | null;
}) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const eventName = jamName ?? "Your jam";
  const dateStr = startsAt
    ? new Date(startsAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#18181b;padding:32px 16px">
  <h1 style="font-size:22px;font-weight:700;margin-bottom:8px">Your jam is posted!</h1>
  <p style="font-size:15px;line-height:1.6;color:#52525b">
    ${greeting} <strong>${eventName}</strong>${dateStr ? ` on ${dateStr}` : ""} is now live on SingJam. You can share it with people or invite them directly from the jam page.
  </p>
  <a href="${jamUrl}"
     style="display:inline-block;margin-top:24px;background-color:#f59e0b;color:#fff;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none">
    View your jam
  </a>
  <p style="margin-top:32px;font-size:13px;color:#a1a1aa">SingJam · Find your jam partner</p>
</body>
</html>`;
}
