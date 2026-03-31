import type { ReactNode } from "react";

export type JamCardData = {
  name: string | null;
  visibility: "official" | "community" | "private";
  starts_at: string | null;
  ends_at: string | null;
  neighborhood: string | null;
  full_address: string | null;
  notes: string | null;
  tickets_url: string | null;
  image_url: string | null;
  genres: string[];
  themes: string[];
  host?: string | null;
  capacity?: number | null;
  hasFullAccess: boolean;
};

function formatDate(startsAt: string): string {
  return new Date(startsAt).toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function MapEmbed({ query, zoom }: { query: string; zoom: number }) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (!key || !query) return null;
  const src = `https://www.google.com/maps/embed/v1/place?key=${key}&q=${encodeURIComponent(query)}&zoom=${zoom}`;
  return (
    <iframe
      src={src}
      width="100%"
      height="100%"
      style={{ border: 0 }}
      allowFullScreen
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}

export default function JamCard({ jam, actions }: { jam: JamCardData; actions?: ReactNode }) {
  const isOfficial = jam.visibility === "official";
  const tags = [...jam.genres, ...jam.themes];

  const showFullAddress = jam.hasFullAccess && jam.full_address;
  const mapQuery = showFullAddress ? jam.full_address! : jam.neighborhood;
  const mapZoom = showFullAddress ? 16 : 13;

  return (
    <div className="pb-10">
      {/* Hero image */}
      {jam.image_url && (
        <div className="-mx-4 -mt-4 sm:-mx-6 mb-6 overflow-hidden" style={{ maxHeight: 320 }}>
          <img
            src={jam.image_url}
            alt={jam.name ?? "Event"}
            className="w-full object-cover"
            style={{ maxHeight: 320 }}
          />
        </div>
      )}

      <div className="space-y-6">
        {/* Header */}
        <div>
          {isOfficial && (
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-amber-500">
              Official SingJam event
            </p>
          )}
          <h1 className="text-2xl font-bold text-zinc-900 leading-tight">
            {jam.name ?? (isOfficial ? "SingJam event" : "Community jam")}
          </h1>
          {jam.host && (
            <p className="mt-1 text-sm text-zinc-500">Hosted by <span className="text-zinc-700 font-medium">{jam.host}</span></p>
          )}
        </div>

        {/* Date / time / location strip */}
        <div className="rounded-2xl border border-zinc-200 bg-white divide-y divide-zinc-100">
          {jam.starts_at && (
            <div className="flex items-start gap-4 px-5 py-4">
              <div className="shrink-0 w-10 text-center">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  {new Date(jam.starts_at).toLocaleDateString(undefined, { month: "short" })}
                </div>
                <div className="text-2xl font-bold text-zinc-900 leading-none">
                  {new Date(jam.starts_at).getDate()}
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-800">{formatDate(jam.starts_at)}</p>
                <p className="text-sm text-zinc-500">
                  {formatTime(jam.starts_at)}
                  {jam.ends_at && ` – ${formatTime(jam.ends_at)}`}
                </p>
              </div>
            </div>
          )}

          {(jam.neighborhood || jam.full_address) && (
            <div className="flex items-start gap-4 px-5 py-4">
              <div className="shrink-0 w-10 flex justify-center pt-0.5">
                <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              </div>
              <div className="min-w-0">
                {showFullAddress ? (
                  <p className="text-sm font-medium text-zinc-800">{jam.full_address}</p>
                ) : (
                  <>
                    <p className="text-sm font-medium text-zinc-800">{jam.neighborhood}</p>
                    {!isOfficial && (
                      <p className="text-xs text-zinc-400 mt-0.5">Full address shown after RSVP</p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {jam.capacity != null && (
            <div className="flex items-start gap-4 px-5 py-4">
              <div className="shrink-0 w-10 flex justify-center pt-0.5">
                <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-zinc-800">{jam.capacity} spots</p>
            </div>
          )}
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t} className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        {(jam.tickets_url || actions) && (
          <div className="flex flex-wrap gap-3 items-center">
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

        {/* Description */}
        {jam.notes && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">About</h2>
            <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">{jam.notes}</p>
          </div>
        )}

        {/* Map */}
        {mapQuery && (
          <div className="overflow-hidden rounded-2xl border border-zinc-200" style={{ height: 260 }}>
            <MapEmbed query={mapQuery} zoom={mapZoom} />
          </div>
        )}
      </div>
    </div>
  );
}
