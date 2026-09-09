import Link from "next/link";
import Image from "next/image";
import { jamTicketCta, type JamTicketSummary } from "@singjam/core";
import { FormattedDate, FormattedTime } from "@/components/FormattedTime";

export type JamEventCardData = {
  id: string;
  name: string | null;
  starts_at: string | null;
  ends_at: string | null;
  timezone?: string | null;
  neighborhood: string | null;
  tickets_url: string | null;
  image_url: string | null;
};

export default function JamEventCard({
  jam,
  ticketSummary,
}: {
  jam: JamEventCardData;
  ticketSummary?: JamTicketSummary | null;
}) {
  const cta = jamTicketCta(jam.tickets_url, ticketSummary, { timezone: jam.timezone });

  return (
    <Link
      href={`/jam/${jam.id}`}
      className="group flex overflow-hidden rounded-2xl border border-amber-200 bg-white transition-colors hover:border-amber-300"
    >
      {jam.image_url ? (
        <div className="relative shrink-0 w-24 sm:w-32 overflow-hidden bg-black">
          <Image src={jam.image_url} alt={jam.name ?? "Event"} fill className="object-contain" sizes="128px" />
        </div>
      ) : jam.starts_at ? (
        <div className="shrink-0 w-20 flex flex-col items-center justify-center bg-amber-50 border-r border-amber-200 px-2 py-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-amber-500">
            <FormattedDate iso={jam.starts_at} timezone={jam.timezone} options={{ weekday: "short" }} />
          </span>
          <span className="text-3xl font-bold text-zinc-900 leading-none">
            <FormattedDate iso={jam.starts_at} timezone={jam.timezone} options={{ day: "numeric" }} />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-amber-500">
            <FormattedDate iso={jam.starts_at} timezone={jam.timezone} options={{ month: "short" }} />
          </span>
        </div>
      ) : null}

      <div className="flex-1 min-w-0 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-500 mb-0.5">Official SingJam event</p>
        <p className="font-semibold text-zinc-900 truncate">{jam.name ?? "SingJam event"}</p>
        {jam.starts_at && (
          <p className="text-xs text-zinc-500 mt-0.5">
            <FormattedDate iso={jam.starts_at} timezone={jam.timezone} options={{ weekday: "short", month: "short", day: "numeric" }} />
            {" · "}
            <FormattedTime iso={jam.starts_at} timezone={jam.timezone} />
            {jam.ends_at && <> – <FormattedTime iso={jam.ends_at} timezone={jam.timezone} /></>}
          </p>
        )}
        {jam.neighborhood && <p className="text-xs text-zinc-400 mt-0.5">{jam.neighborhood}</p>}
        {/* Not a link: the card is the link, so a nested anchor to the same
            place would be invalid markup. It is the card's affordance. */}
        <p className={`mt-2 text-xs font-medium ${cta.hasTickets ? "text-amber-600 group-hover:text-amber-500" : "text-zinc-500 group-hover:text-zinc-700"}`}>
          {cta.label} →
        </p>
      </div>
    </Link>
  );
}
