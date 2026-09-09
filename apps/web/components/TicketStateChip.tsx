import type { JamTicketState } from "@singjam/core";

/**
 * Ticket state on a listing card. Deliberately not a link: the card itself is
 * the link, and an event selling off-site gets its real outbound button on the
 * detail page — a nested anchor here would be invalid markup.
 */
export default function TicketStateChip({ state }: { state: JamTicketState }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        state.muted ? "bg-zinc-100 text-zinc-500" : "bg-amber-500 text-white"
      }`}
    >
      {state.label}
      {state.url && " ↗"}
    </span>
  );
}
