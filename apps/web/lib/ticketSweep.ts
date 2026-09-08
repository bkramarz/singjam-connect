import type { SupabaseClient } from "@supabase/supabase-js";
import { resend, FROM_ADDRESS } from "@/lib/resend";
import { SITE_URL } from "@/lib/stripe";
import { sendTicketEmail, type PaidOrder } from "@/lib/ticketFulfilment";
import { ticketDeliveryFailedEmailHtml, type FailedTicketDelivery } from "@/emails/ticket-delivery-failed";

// The failure Stripe cannot see. It watches for our endpoint erroring, not for
// it returning 200 while the ticket never went out — which is exactly what
// happens when the confirmation email throws, because fulfilment deliberately
// swallows that rather than failing a webhook for an order that is correctly
// paid. Money taken, no ticket, and nobody told.
//
// Migration 154 built the detector and nothing read it: a partial index on
// (status = 'paid' and ticket_email_sent_at is null). This is its reader. It
// retries first, because a transient Resend outage is the likeliest cause and a
// retry fixes it outright, and only alerts a human for what it cannot deliver.

const ALERT_TO = "events@singjam.org";
const ALERT_FLAG = "ticket_delivery_failed_notified";
const ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;

// A batch drain, not a rendered list: the sweep runs every ten minutes, so
// anything past the cap is picked up on the next pass. More than a handful here
// is already the emergency the alert is for.
const SWEEP_LIMIT = 50;

const ORDER_COLS =
  "id, jam_id, buyer_user_id, buyer_email, buyer_name, amount_cents, currency, paid_at";

type UndeliveredOrder = PaidOrder & { paid_at: string | null };

export type TicketSweepResult = {
  pending: number;
  delivered: number;
  failed: number;
  alerted: boolean;
};

const formatAmount = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

// Shown in the event's own timezone: whoever reads this is about to talk to a
// buyer about a specific door, and a UTC stamp makes them do the arithmetic.
const formatPaidAt = (paidAt: string | null, timezone: string | null) => {
  if (!paidAt) return "unknown";
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone ?? "America/Los_Angeles",
    }).format(new Date(paidAt));
  } catch {
    return paidAt;
  }
};

// Alerts once per situation rather than once per sweep: a repeat every ten
// minutes would train the recipient to ignore it. Any order the last alert did
// not name is new money at risk, so that always sends immediately; the cooldown
// only governs re-nagging about the same orders.
async function alertUndelivered(admin: SupabaseClient, failures: FailedTicketDelivery[]): Promise<boolean> {
  const { data } = await admin.from("system_flags").select("value").eq("key", ALERT_FLAG).maybeSingle();

  let alreadyNamed: string[] = [];
  let lastAlertAt = 0;
  try {
    const parsed = data?.value ? JSON.parse(data.value) : null;
    if (parsed) {
      alreadyNamed = Array.isArray(parsed.ids) ? parsed.ids : [];
      lastAlertAt = Date.parse(parsed.at) || 0;
    }
  } catch {
    // Unreadable flag: treat as never alerted rather than staying silent.
  }

  const hasNewOrder = failures.some((f) => !alreadyNamed.includes(f.orderId));
  if (!hasNewOrder && Date.now() - lastAlertAt < ALERT_COOLDOWN_MS) return false;

  const now = new Date().toISOString();
  await resend.emails.send({
    from: FROM_ADDRESS,
    to: ALERT_TO,
    subject: `Action required: ${failures.length} paid ticket${failures.length === 1 ? "" : "s"} not delivered`,
    html: ticketDeliveryFailedEmailHtml(failures),
  });
  await admin.from("system_flags").upsert({
    key: ALERT_FLAG,
    value: JSON.stringify({ at: now, ids: failures.map((f) => f.orderId) }),
    updated_at: now,
  });
  return true;
}

export async function sweepUndeliveredTickets(admin: SupabaseClient): Promise<TicketSweepResult> {
  const idle: TicketSweepResult = { pending: 0, delivered: 0, failed: 0, alerted: false };

  const { data, error } = await admin
    .from("ticket_orders")
    .select(ORDER_COLS)
    .eq("status", "paid")
    .is("ticket_email_sent_at", null)
    .order("paid_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(SWEEP_LIMIT);

  if (error) {
    console.error(`[ticketSweep] queue query failed: ${error.message}`);
    return idle;
  }

  const orders = (data ?? []) as UndeliveredOrder[];
  if (orders.length === 0) return idle;

  // One lookup for the whole batch: the alert is useless without event names.
  const { data: jams } = await admin
    .from("jams")
    .select("id, name, timezone")
    .in("id", [...new Set(orders.map((o) => o.jam_id))]);
  const jamsById = new Map((jams ?? []).map((j: any) => [j.id, j]));

  const failures: FailedTicketDelivery[] = [];
  let delivered = 0;

  for (const order of orders) {
    const jam = jamsById.get(order.jam_id);
    const describe = (reason: string): FailedTicketDelivery => ({
      orderId: order.id,
      jamName: jam?.name ?? "an event",
      jamUrl: `${SITE_URL}/jam/${order.jam_id}`,
      buyerEmail: order.buyer_email,
      amountLabel: formatAmount(order.amount_cents, order.currency),
      paidLabel: formatPaidAt(order.paid_at, jam?.timezone ?? null),
      reason,
    });

    try {
      if (await sendTicketEmail(admin, order)) {
        const now = new Date().toISOString();
        await admin
          .from("ticket_orders")
          .update({ ticket_email_sent_at: now, updated_at: now })
          .eq("id", order.id);
        delivered++;
        continue;
      }
      // No address anywhere on the order. Retrying will never help, so this
      // one only ever leaves the queue by hand.
      failures.push(describe("No email address on the order or on the buyer's account."));
    } catch (err) {
      failures.push(describe(err instanceof Error ? err.message : String(err)));
    }
  }

  let alerted = false;
  if (failures.length > 0) {
    for (const f of failures) {
      console.error(`[ticketSweep] ticket undelivered for order ${f.orderId}: ${f.reason}`);
    }
    try {
      alerted = await alertUndelivered(admin, failures);
    } catch (err) {
      console.error("[ticketSweep] alert send failed:", err);
    }
  }

  return { pending: orders.length, delivered, failed: failures.length, alerted };
}

// Bookkeeping, not correctness — ticket_type_sold_count already ignores elapsed
// holds. But nothing has ever called this function, so an abandoned checkout
// whose expiry webhook never landed stays "pending" forever and shows on the
// host page as held stock. Production still had one from launch week.
export async function expireStaleTicketHolds(admin: SupabaseClient): Promise<number> {
  const { data, error } = await admin.rpc("expire_stale_ticket_orders");
  if (error) {
    console.error(`[ticketSweep] expire_stale_ticket_orders failed: ${error.message}`);
    return 0;
  }
  return typeof data === "number" ? data : 0;
}
