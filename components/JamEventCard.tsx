import Link from "next/link";
import Image from "next/image";
import { FormattedDate, FormattedTime } from "@/components/FormattedTime";

export type JamEventCardData = {
  id: string;
  name: string | null;
  starts_at: string | null;
  ends_at: string | null;
  neighborhood: string | null;
  tickets_url: string | null;
  image_url: string | null;
};

export default function JamEventCard({ jam }: { jam: JamEventCardData }) {
  return (
    <div className="flex overflow-hidden rounded-2xl border border-amber-200 bg-white">
      {jam.image_url ? (
        <div className="relative shrink-0 w-24 sm:w-32 overflow-hidden">
          <Image src={jam.image_url} alt={jam.name ?? "Event"} fill className="object-cover" sizes="128px" unoptimized />
        </div>
      ) : jam.starts_at ? (
        <div className="shrink-0 w-20 flex flex-col items-center justify-center bg-amber-50 border-r border-amber-200 px-2 py-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-amber-500">
            <FormattedDate iso={jam.starts_at} options={{ weekday: "short" }} />
          </span>
          <span className="text-3xl font-bold text-zinc-900 leading-none">
            <FormattedDate iso={jam.starts_at} options={{ day: "numeric" }} />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-amber-500">
            <FormattedDate iso={jam.starts_at} options={{ month: "short" }} />
          </span>
        </div>
      ) : null}

      <div className="flex-1 min-w-0 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-500 mb-0.5">Official SingJam event</p>
        <p className="font-semibold text-zinc-900 truncate">{jam.name ?? "SingJam event"}</p>
        {jam.starts_at && (
          <p className="text-xs text-zinc-500 mt-0.5">
            <FormattedDate iso={jam.starts_at} options={{ weekday: "short", month: "short", day: "numeric" }} />
            {" · "}
            <FormattedTime iso={jam.starts_at} />
            {jam.ends_at && <> – <FormattedTime iso={jam.ends_at} /></>}
          </p>
        )}
        {jam.neighborhood && <p className="text-xs text-zinc-400 mt-0.5">{jam.neighborhood}</p>}
        <div className="mt-2 flex flex-wrap gap-3">
          <Link href={`/jam/${jam.id}`} className="text-xs font-medium text-zinc-500 hover:text-zinc-700">
            View details →
          </Link>
          {jam.tickets_url && (
            <a href={jam.tickets_url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-amber-600 hover:text-amber-500">
              Get tickets ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
