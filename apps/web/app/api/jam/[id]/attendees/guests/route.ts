import { NextResponse } from "next/server";
import { fetchAllRows } from "@singjam/core";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Guests who bought a ticket without an account. They are coming, so they
// belong on the guest list, but jam_rsvps.user_id is NOT NULL and references
// profiles — there is nowhere to record them in the attendance model, and
// tickets is service_role-only, so the browser cannot read them directly.
//
// Names only. The door list at ../../tickets/orders carries emails and codes and
// is host-gated; this one is not, so it must never grow those fields. Guests
// exist only on official events, which are world-readable and whose "going"
// list is already public, so no new exposure.

type TicketRow = {
  order_id: string;
  holder_name: string | null;
  ticket_orders: { status: string; buyer_name: string | null } | null;
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: jamId } = await params;
  const admin = supabaseAdmin();

  const { data: jam } = await admin.from("jams").select("id").eq("id", jamId).maybeSingle();
  if (!jam) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The whole list, not a page of it — a cap would silently drop guests off the
  // end. Ordered on a unique tiebreaker so rows can't shift between pages.
  const tickets = await fetchAllRows<TicketRow>(
    (from, to) =>
      admin
        .from("tickets")
        .select("id, order_id, holder_name, ticket_orders!inner(status, buyer_name)")
        .eq("jam_id", jamId)
        .is("holder_user_id", null)
        .eq("ticket_orders.status", "paid")
        .order("id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: TicketRow[] | null; error?: any }>
  );

  // One entry per order, not per ticket: somebody who bought four tickets gave
  // one name, and listing it four times reads as a bug rather than a party.
  const byOrder = new Map<string, { name: string; tickets: number }>();
  for (const t of tickets) {
    const existing = byOrder.get(t.order_id);
    if (existing) {
      existing.tickets += 1;
      continue;
    }
    byOrder.set(t.order_id, {
      name: t.holder_name ?? t.ticket_orders?.buyer_name ?? "Guest",
      tickets: 1,
    });
  }

  return NextResponse.json({
    guests: [...byOrder.values()].map((g) => ({ name: g.name, extra: g.tickets - 1 })),
  });
}
