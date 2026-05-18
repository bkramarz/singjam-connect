export type IcsEvent = {
  uid: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  description: string | null;
  sequence?: number;
};

function toCalDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
}

function fallbackEnd(startsAt: string): string {
  return new Date(new Date(startsAt).getTime() + 2 * 60 * 60 * 1000).toISOString();
}

export function buildIcs(event: IcsEvent, method = "PUBLISH"): string {
  const { uid, title, startsAt, endsAt, location, description, sequence = 0 } = event;
  const start = toCalDate(startsAt);
  const end = toCalDate(endsAt ?? fallbackEnd(startsAt));
  const dtstamp = toCalDate(new Date().toISOString());

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SingJam//SingJam//EN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `SEQUENCE:${sequence}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${title}`,
    description ? `DESCRIPTION:${description.replace(/\n/g, "\\n")}` : null,
    location ? `LOCATION:${location}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}
