import { formatJamTime } from "../lib/formatJamTime";

// Door staff look guests up by name or by this code, so it has to be short
// enough to read aloud from a phone screen in a noisy room.
export function ticketCode(qrToken: string) {
  return qrToken.replace(/-/g, "").slice(0, 6).toUpperCase();
}

function calendarUrls({
  title,
  startsAt,
  endsAt,
  location,
}: {
  title: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
}) {
  const end = endsAt ?? new Date(new Date(startsAt).getTime() + 2 * 60 * 60 * 1000).toISOString();
  const fmt = (iso: string) => new Date(iso).toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";

  const google = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${fmt(startsAt)}/${fmt(end)}`,
  });
  const outlook = new URLSearchParams({
    subject: title,
    startdt: startsAt,
    enddt: end,
    path: "/calendar/action/compose",
    rru: "addevent",
  });
  if (location) {
    google.set("location", location);
    outlook.set("location", location);
  }
  return {
    google: `https://www.google.com/calendar/render?${google}`,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?${outlook}`,
  };
}

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

export function ticketConfirmationHtml({
  name,
  jamName,
  jamId,
  jamUrl,
  startsAt,
  endsAt,
  timezone,
  address,
  tickets,
  amountCents,
  currency,
}: {
  name?: string | null;
  jamName: string;
  jamId: string;
  jamUrl: string;
  startsAt?: string | null;
  endsAt?: string | null;
  timezone?: string | null;
  address?: string | null;
  tickets: { tierName: string; qrToken: string }[];
  amountCents: number;
  currency: string;
}) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const dateStr = formatJamTime(startsAt, timezone);
  const icsUrl = `https://singjam.org/api/jam/${jamId}/ics`;
  const cal = startsAt
    ? calendarUrls({ title: jamName, startsAt, endsAt: endsAt ?? null, location: address ?? null })
    : null;

  const plural = tickets.length === 1 ? "ticket" : "tickets";

  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#18181b;padding:32px 16px">
  <h1 style="font-size:22px;font-weight:700;margin-bottom:8px">Your ${plural} for ${jamName} 🎟️</h1>
  <p style="font-size:15px;line-height:1.6;color:#52525b">
    ${greeting} Your payment of <strong>${money(amountCents, currency)}</strong> is confirmed.
    Show this email at the door, or just give your name.
  </p>

  <div style="margin-top:20px;padding:16px;background:#f4f4f5;border-radius:10px">
    <p style="font-size:13px;font-weight:600;color:#71717a;margin:0 0 10px">Your ${plural}</p>
    ${tickets
      .map(
        (t) => `
    <div style="display:block;padding:10px 0;border-top:1px solid #e4e4e7">
      <span style="font-size:15px;font-weight:500;color:#18181b">${t.tierName}</span>
      <span style="float:right;font-size:15px;font-family:monospace;letter-spacing:1px;color:#52525b">${ticketCode(t.qrToken)}</span>
    </div>`
      )
      .join("")}
  </div>

  ${dateStr ? `
  <div style="margin-top:12px;padding:16px;background:#f4f4f5;border-radius:10px">
    <p style="font-size:13px;font-weight:600;color:#71717a;margin:0 0 4px">When</p>
    <p style="font-size:15px;font-weight:500;color:#18181b;margin:0">${dateStr}</p>
  </div>` : ""}

  ${address ? `
  <div style="margin-top:12px;padding:16px;background:#f4f4f5;border-radius:10px">
    <p style="font-size:13px;font-weight:600;color:#71717a;margin:0 0 4px">Where</p>
    <a href="https://maps.google.com/?q=${encodeURIComponent(address)}"
       style="font-size:15px;font-weight:500;color:#18181b;margin:0;text-decoration:underline">${address}</a>
  </div>` : ""}

  ${cal ? `
  <div style="margin-top:24px">
    <p style="font-size:13px;font-weight:600;color:#71717a;margin:0 0 10px">Add to calendar</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <a href="${cal.google}"
         style="display:inline-block;padding:8px 16px;border:1px solid #e4e4e7;border-radius:8px;font-size:13px;font-weight:500;color:#18181b;text-decoration:none">
        Google Calendar
      </a>
      <a href="${icsUrl}"
         style="display:inline-block;padding:8px 16px;border:1px solid #e4e4e7;border-radius:8px;font-size:13px;font-weight:500;color:#18181b;text-decoration:none">
        Apple Calendar
      </a>
      <a href="${cal.outlook}"
         style="display:inline-block;padding:8px 16px;border:1px solid #e4e4e7;border-radius:8px;font-size:13px;font-weight:500;color:#18181b;text-decoration:none">
        Outlook
      </a>
    </div>
  </div>` : ""}

  <a href="${jamUrl}"
     style="display:inline-block;margin-top:24px;background-color:#f59e0b;color:#fff;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none">
    View event
  </a>
  <p style="margin-top:32px;font-size:13px;color:#a1a1aa">SingJam · Music. Community. Love.</p>
</body>
</html>`;
}
