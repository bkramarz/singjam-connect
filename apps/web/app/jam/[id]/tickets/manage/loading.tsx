import { TicketManagerSkeleton } from "@/components/TicketTierManager";

export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div>
        <div className="h-3 w-24 animate-pulse rounded bg-zinc-100" />
        <div className="mt-2 h-7 w-28 animate-pulse rounded bg-zinc-200" />
      </div>
      <TicketManagerSkeleton />
    </div>
  );
}
