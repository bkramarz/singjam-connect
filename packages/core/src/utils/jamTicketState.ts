/**
 * Ticket state for an official event as shown in a *listing* (home page,
 * /jams, the native jams tab) — not the detail page, where the purchase panel
 * shows the real tiers.
 *
 * An event sells either through an external link or through our own tiers,
 * never both, so tickets_url wins outright when it is set.
 */

/** One row of the jam_ticket_tiers(uuid[]) RPC (migration 164). */
export type JamTicketTier = {
  jam_id: string;
  ticket_type_id: string;
  price_cents: number;
  currency: string | null;
  /** null = uncapped. */
  remaining: number | null;
  not_yet_open: boolean;
  closed: boolean;
  sales_start_at: string | null;
};

/** A jam's tiers folded into the facts a listing card needs. */
export type JamTicketSummary = {
  jam_id: string;
  tier_count: number;
  on_sale_count: number;
  /** Cheapest tier a buyer can take right now; null when nothing is on sale. */
  min_price_cents: number | null;
  currency: string | null;
  sold_out: boolean;
  next_sales_start_at: string | null;
};

function onSale(tier: JamTicketTier): boolean {
  return !tier.not_yet_open && !tier.closed && (tier.remaining === null || tier.remaining > 0);
}

/**
 * Folds the RPC's per-tier rows into one summary per jam. Lives here rather
 * than in SQL so web and native share one implementation of the rollup rules
 * and they stay under test.
 */
export function summarizeTicketTiers(
  rows: JamTicketTier[] | null | undefined
): Map<string, JamTicketSummary> {
  // "Sold out" is only about tiers still inside their sales window: a closed
  // tier ran out of time rather than stock, so counting those would report a
  // sellout nobody caused. Hence the open/empty tally alongside the summary.
  const acc = new Map<string, { summary: JamTicketSummary; openTiers: number; emptyTiers: number }>();

  for (const tier of rows ?? []) {
    let entry = acc.get(tier.jam_id);
    if (!entry) {
      entry = {
        summary: {
          jam_id: tier.jam_id,
          tier_count: 0,
          on_sale_count: 0,
          min_price_cents: null,
          currency: null,
          sold_out: false,
          next_sales_start_at: null,
        },
        openTiers: 0,
        emptyTiers: 0,
      };
      acc.set(tier.jam_id, entry);
    }
    const { summary } = entry;

    summary.tier_count += 1;

    if (onSale(tier)) {
      summary.on_sale_count += 1;
      if (summary.min_price_cents === null || tier.price_cents < summary.min_price_cents) {
        summary.min_price_cents = tier.price_cents;
        summary.currency = tier.currency;
      }
    }

    if (!tier.closed) {
      entry.openTiers += 1;
      // An uncapped tier (null) can never run out.
      if (tier.remaining === 0) entry.emptyTiers += 1;
    }

    if (tier.not_yet_open && tier.sales_start_at) {
      const earliest = summary.next_sales_start_at;
      if (!earliest || tier.sales_start_at < earliest) {
        summary.next_sales_start_at = tier.sales_start_at;
      }
    }
  }

  const byJam = new Map<string, JamTicketSummary>();
  for (const [jamId, { summary, openTiers, emptyTiers }] of acc) {
    summary.sold_out = openTiers > 0 && emptyTiers === openTiers;
    byJam.set(jamId, summary);
  }
  return byJam;
}

export type JamTicketState = {
  label: string;
  /** Set only for events selling off-site; the caller opens it externally. */
  url: string | null;
  /** True for states that report a fact rather than invite a click. */
  muted: boolean;
};

function money(cents: number, currency: string | null): string {
  const code = (currency ?? "usd").toUpperCase();
  const amount = cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
  return code === "USD" ? `$${amount}` : `${amount} ${code}`;
}

export function jamTicketState(
  ticketsUrl: string | null | undefined,
  summary: JamTicketSummary | null | undefined,
  opts: { timezone?: string | null; now?: Date } = {}
): JamTicketState | null {
  if (ticketsUrl) return { label: "Tickets", url: ticketsUrl, muted: false };
  if (!summary || summary.tier_count === 0) return null;

  if (summary.sold_out) return { label: "Sold out", url: null, muted: true };

  if (summary.on_sale_count > 0) {
    const cents = summary.min_price_cents ?? 0;
    if (cents === 0) return { label: "Free", url: null, muted: false };
    const price = money(cents, summary.currency);
    return {
      label: summary.tier_count > 1 ? `From ${price}` : price,
      url: null,
      muted: false,
    };
  }

  if (summary.next_sales_start_at) {
    const opensAt = new Date(summary.next_sales_start_at);
    const now = opts.now ?? new Date();
    // Beyond a week out a weekday is ambiguous ("Fri" — this one or next?), so
    // switch to a date once it stops reading as "soon".
    const soon = opensAt.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000;
    const when = opensAt.toLocaleDateString("en-US", {
      timeZone: opts.timezone ?? undefined,
      ...(soon ? { weekday: "short" } : { month: "short", day: "numeric" }),
    });
    return { label: `Tickets open ${when}`, url: null, muted: true };
  }

  return { label: "Sales closed", url: null, muted: true };
}
