import { formatJamTime } from "@/lib/formatJamTime";

export function jamUpdatedHtml({
  name,
  jamName,
  jamUrl,
  timeChanged,
  locationChanged,
  newStartsAt,
  newLocation,
  timezone,
}: {
  name?: string | null;
  jamName?: string | null;
  jamUrl: string;
  timeChanged: boolean;
  locationChanged: boolean;
  newStartsAt?: string | null;
  newLocation?: string | null;
  timezone?: string | null;
}) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const changedParts = [timeChanged && "time", locationChanged && "location"].filter(Boolean).join(" and ");
  const dateStr = timeChanged ? formatJamTime(newStartsAt, timezone) : null;

  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#18181b;padding:32px 16px">
  <h1 style="font-size:22px;font-weight:700;margin-bottom:8px">Jam details updated</h1>
  <p style="font-size:15px;line-height:1.6;color:#52525b">
    ${greeting} The ${changedParts} for <strong>${jamName ?? "a jam you're attending"}</strong> has been updated.
  </p>
  ${dateStr ? `
  <div style="margin-top:20px;padding:16px;background:#f4f4f5;border-radius:10px">
    <p style="font-size:13px;font-weight:600;color:#71717a;margin:0 0 4px">New time</p>
    <p style="font-size:15px;font-weight:500;color:#18181b;margin:0">${dateStr}</p>
  </div>` : ""}
  ${locationChanged && newLocation ? `
  <div style="margin-top:12px;padding:16px;background:#f4f4f5;border-radius:10px">
    <p style="font-size:13px;font-weight:600;color:#71717a;margin:0 0 4px">New location</p>
    <p style="font-size:15px;font-weight:500;color:#18181b;margin:0">${newLocation}</p>
  </div>` : ""}
  <p style="margin-top:20px;font-size:14px;color:#52525b">Your calendar invite is attached — open it to update your calendar app.</p>
  <a href="${jamUrl}"
     style="display:inline-block;margin-top:24px;background-color:#18181b;color:#fff;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none">
    View jam
  </a>
  <p style="margin-top:32px;font-size:13px;color:#a1a1aa">SingJam · Find your jam partner</p>
</body>
</html>`;
}
