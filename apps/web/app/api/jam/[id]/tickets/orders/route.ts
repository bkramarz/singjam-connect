import { NextResponse } from "next/server";
import { fetchAllRows } from "@singjam/core";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseFromBearer } from "@/lib/supabase/bearer";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The host's guest list and sales summary. Host or co-host only — this exposes
// buyer names, emails and amounts paid.

type TicketRow = {
  id: string;
  qr_token: string;
  holder_name: string | null;
  holder_email: string | null;
  checked_in_at: string | null;
  ticket_types: { name: string } | null;
  ticket_orders: {
    id: string;
    status: string;
    buyer_name: string | null;
    buyer_email: string | null;
    buyer_user_id: string | null;
    amount_cents: number;
    currency: string;
    paid_at: string | null;
  } | null;
};

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: jamId } = await params;

  const supabase = await supabaseServer();
  let user = (await supabase.auth.getUser()).data.user ?? null;
  if (!user) {
    const bearer = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (bearer) user = (await supabaseFromBearer(bearer).auth.getUser()).data.user ?? null;
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();

  const { data: jam } = await admin.from("jams").select("host_user_id").eq("id", jamId).maybeSingle();
  if (!jam) return NextResponse.json({ error: "Jam not found" }, { status: 404 });

  if (jam.host_user_id !== user.id) {
    const { data: cohost } = await admin
      .from("jam_cohosts")
      .select("id")
      .eq("jam_id", jamId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!cohost) {
      return NextResponse.json({ error: "Only the host can view ticket sales" }, { status: 403 });
    }
  }

  // The full guest list, not a page of it — a capped fetch would silently drop
  // attendees off the end of the door list. Ordered on a unique tiebreaker so
  // rows can't shift across page boundaries.
  // Cast at the boundary: supabaseAdmin() is an untyped client, so it cannot
  // infer the shape of the embedded joins from the select string.
  const tickets = await fetchAllRows<TicketRow>(
    (from, to) =>
      admin
        .from("tickets")
        .select(
          `id, qr_token, holder_name, holder_email, checked_in_at,
           ticket_types(name),
           ticket_orders!inner(id, status, buyer_name, buyer_email, buyer_user_id, amount_cents, currency, paid_at)`
        )
        .eq("jam_id", jamId)
        .eq("ticket_orders.status", "paid")
        .order("id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: TicketRow[] | null; error?: any }>
  );

  // Members bought without supplying a name, so resolve theirs from profiles.
  const memberIds = [
    ...new Set(
      tickets.map((t) => t.ticket_orders?.buyer_user_id).filter((v): v is string => !!v)
    ),
  ];
  const profileNames = new Map<string, string>();
  if (memberIds.length) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_name, username")
      .in("id", memberIds);
    for (const p of profiles ?? []) {
      profileNames.set(p.id, (p as any).display_name ?? (p as any).username ?? "");
    }
  }

  const guests = tickets.map((t) => {
    const o = t.ticket_orders!;
    const name =
      t.holder_name ??
      o.buyer_name ??
      (o.buyer_user_id ? profileNames.get(o.buyer_user_id) || null : null);
    return {
      ticket_id: t.id,
      code: t.qr_token.replace(/-/g, "").slice(0, 6).toUpperCase(),
      name: name || "Guest",
      email: t.holder_email ?? o.buyer_email ?? null,
      tier: t.ticket_types?.name ?? "Ticket",
      is_member: !!o.buyer_user_id,
      checked_in_at: t.checked_in_at,
      order_id: o.id,
      paid_at: o.paid_at,
    };
  });

  guests.sort((a, b) => a.name.localeCompare(b.name) || a.ticket_id.localeCompare(b.ticket_id));

  // Revenue is summed per order, not per ticket, or a multi-ticket order counts
  // its total once for every ticket in it.
  const orderTotals = new Map<string, { amount: number; currency: string }>();
  for (const t of tickets) {
    const o = t.ticket_orders!;
    orderTotals.set(o.id, { amount: o.amount_cents, currency: o.currency });
  }
  const grossCents = [...orderTotals.values()].reduce((sum, o) => sum + o.amount, 0);

  return NextResponse.json({
    guests,
    summary: {
      tickets_sold: guests.length,
      orders: orderTotals.size,
      gross_cents: grossCents,
      currency: [...orderTotals.values()][0]?.currency ?? "usd",
      checked_in: guests.filter((g) => g.checked_in_at).length,
    },
  });
}
