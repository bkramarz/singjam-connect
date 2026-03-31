import type { ReactNode } from "react";

export type JamCardData = {
  name: string | null;
  visibility: "official" | "community" | "private";
  starts_at: string | null;
  ends_at: string | null;
  neighborhood: string | null;
  notes: string | null;
  tickets_url: string | null;
  image_url: string | null;
  genres: string[];
  themes: string[];
  host?: string | null;
};

function formatDateRange(startsAt: string | null, endsAt: string | null): string | null {
  if (!startsAt) return null;
  const start = new Date(startsAt);
  const dateStr = start.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const startTime = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (!endsAt) return `${dateStr} · ${startTime}`;
  const end = new Date(endsAt);
  const endTime = end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${dateStr} · ${startTime} – ${endTime}`;
}

export default function JamCard({ jam, actions }: { jam: JamCardData; actions?: ReactNode }) {
  const isOfficial = jam.visibility === "official";
  const tags = [...jam.genres, ...jam.themes];
  const dateStr = formatDateRange(jam.starts_at, jam.ends_at);

  return (
    <div className="space-y-5 pb-10">
      {/* Cover image */}
      {jam.image_url && (
        <div className="overflow-hidden rounded-2xl">
          <img src={jam.image_url} alt={jam.name ?? "Jam"} className="w-full object-cover max-h-64" />
        </div>
      )}

      {/* Header */}
      <div className="space-y-1">
        {isOfficial && (
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">Official SingJam event</p>
        )}
        <h1 className="text-2xl font-bold text-zinc-900">{jam.name ?? (isOfficial ? "SingJam event" : "Community jam")}</h1>
        {jam.host && <p className="text-sm text-zinc-500">Hosted by {jam.host}</p>}
      </div>

      {/* Details card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
        {dateStr && (
          <div className="flex items-start gap-3">
            <span className="text-zinc-400 mt-0.5">📅</span>
            <span className="text-sm text-zinc-700">{dateStr}</span>
          </div>
        )}
        {jam.neighborhood && (
          <div className="flex items-start gap-3">
            <span className="text-zinc-400 mt-0.5">📍</span>
            <span className="text-sm text-zinc-700">{jam.neighborhood}</span>
          </div>
        )}
        {tags.length > 0 && (
          <div className="flex items-start gap-3">
            <span className="text-zinc-400 mt-0.5">🎵</span>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600">{t}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Description */}
      {jam.notes && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">About this jam</h2>
          <p className="text-sm text-zinc-700 whitespace-pre-wrap">{jam.notes}</p>
        </div>
      )}

      {/* Actions */}
      {(jam.tickets_url || actions) && (
        <div className="flex flex-wrap gap-3">
          {jam.tickets_url && (
            <a
              href={jam.tickets_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-400 transition-colors"
            >
              Get tickets ↗
            </a>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}
