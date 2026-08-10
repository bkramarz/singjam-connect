import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe, SITE_URL } from "@/lib/stripe";
import { resend, FROM_ADDRESS } from "@/lib/resend";
import { ticketConfirmationHtml } from "@/emails/ticket-confirmation";

// Fulfilment happens here, never in the browser's return_url handler — the
// buyer can close the tab before it runs, and a client callback can be forged.
// Stripe may redeliver any event, so every branch must be idempotent.

type PaidOrder = {
  id: string;
  jam_id: string;
  buyer_user_id: string | null;
  buyer_email: string | null;
  buyer_name: string | null;
  amount_cents: number;
  currency: string;
};

// Resolves the recipient and ticket list, then sends. Members may have no
// buyer_email stored, so fall back to their auth record.
async function sendTicketEmail(admin: ReturnType<typeof supabaseAdmin>, order: PaidOrder) {
  let email = order.buyer_email;
  let name = order.buyer_name;

  if (!email && order.buyer_user_id) {
    const [{ data: authData }, { data: profile }] = await Promise.all([
      admin.auth.admin.getUserById(order.buyer_user_id),
      admin.from("profiles").select("display_name, username").eq("id", order.buyer_user_id).maybeSingle(),
    ]);
    email = authData.user?.email ?? null;
    name = name ?? (profile as any)?.display_name ?? (profile as any)?.username ?? null;
  }
  if (!email) return;

  const [{ data: jam }, { data: tickets }] = await Promise.all([
    admin
      .from("jams")
      .select("name, starts_at, ends_at, timezone, full_address, neighborhood")
      .eq("id", order.jam_id)
      .maybeSingle(),
    admin
      .from("tickets")
      .select("qr_token, ticket_types(name)")
      .eq("order_id", order.id),
  ]);

  const jamName = jam?.name ?? "the jam";

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: `Your ticket${(tickets ?? []).length === 1 ? "" : "s"} for ${jamName}`,
    html: ticketConfirmationHtml({
      name,
      jamName,
      jamId: order.jam_id,
      jamUrl: `${SITE_URL}/jam/${order.jam_id}`,
      startsAt: jam?.starts_at,
      endsAt: (jam as any)?.ends_at ?? null,
      timezone: (jam as any)?.timezone,
      address: jam?.full_address ?? jam?.neighborhood ?? null,
      tickets: (tickets ?? []).map((t: any) => ({
        tierName: t.ticket_types?.name ?? "Ticket",
        qrToken: t.qr_token,
      })),
      amountCents: order.amount_cents,
      currency: order.currency,
    }),
  });
}

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  // Must be the raw body — parsing it first would break signature verification.
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const now = new Date().toISOString();

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;

      // Delayed methods can report completed while still unpaid.
      if (session.payment_status === "unpaid") break;

      const orderId = session.metadata?.order_id ?? session.client_reference_id;
      if (!orderId) break;

      // Idempotent: only a pending order transitions, so redelivery is a no-op
      // and a later refund event cannot be undone by a replayed success.
      const { data: updated } = await admin
        .from("ticket_orders")
        .update({
          status: "paid",
          paid_at: now,
          updated_at: now,
          stripe_payment_intent_id:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
          // Reconcile to what Stripe actually charged. Our amount_cents was
          // computed from tier prices before checkout; a promotion code (or any
          // Stripe-side adjustment) makes it stale, and reporting the
          // pre-discount figure would overstate revenue.
          ...(typeof session.amount_total === "number"
            ? { amount_cents: session.amount_total }
            : {}),
        })
        .eq("id", orderId)
        .eq("status", "pending")
        .select("id, jam_id, buyer_user_id, buyer_email, buyer_name, amount_cents, currency, ticket_email_sent_at")
        .maybeSingle();

      if (!updated) break;

      // Send the ticket before anything else — for a guest this email is their
      // only copy. Guarded on the timestamp so a redelivered webhook can't send
      // twice, and isolated so a mail failure never fails the whole webhook
      // (Stripe would retry it, and the order is already correctly paid).
      if (!updated.ticket_email_sent_at) {
        try {
          await sendTicketEmail(admin, updated);
          await admin
            .from("ticket_orders")
            .update({ ticket_email_sent_at: now })
            .eq("id", updated.id);
        } catch (e) {
          // Left unstamped on purpose: the partial index on
          // (status='paid' and ticket_email_sent_at is null) is exactly the
          // work queue a retry sweeper reads.
          console.error("ticket confirmation email failed", updated.id, e);
        }
      }

      // Guest orders have no profile to attach attendance to. The order and its
      // tickets are the record; jam_rsvps.user_id is NOT NULL and references
      // profiles, so there is nothing to write here for them.
      if (!updated.buyer_user_id) break;

      // Mirror the paid order into the existing attendance model so attendee
      // lists, linked set lists and the host's notifications keep working —
      // official events otherwise have no RSVP row at all.
      const { data: existingRsvp } = await admin
        .from("jam_rsvps")
        .select("id")
        .eq("jam_id", updated.jam_id)
        .eq("user_id", updated.buyer_user_id)
        .maybeSingle();

      if (existingRsvp) {
        await admin
          .from("jam_rsvps")
          .update({ status: "attending", waitlist_position: null })
          .eq("id", existingRsvp.id);
      } else {
        await admin.from("jam_rsvps").insert({
          jam_id: updated.jam_id,
          user_id: updated.buyer_user_id,
          status: "attending",
          waitlist_position: null,
        });
      }
      break;
    }

    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.order_id ?? session.client_reference_id;
      if (!orderId) break;

      await admin
        .from("ticket_orders")
        .update({
          status: event.type === "checkout.session.expired" ? "expired" : "failed",
          updated_at: now,
        })
        .eq("id", orderId)
        .eq("status", "pending");
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const intentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
      if (!intentId) break;

      // Only a full refund voids the order; a partial refund leaves the tickets
      // valid and is reconciled in the Dashboard.
      if (charge.amount_refunded < charge.amount) break;

      const { data: order } = await admin
        .from("ticket_orders")
        .update({ status: "refunded", updated_at: now })
        .eq("stripe_payment_intent_id", intentId)
        .eq("status", "paid")
        .select("id, jam_id, buyer_user_id")
        .maybeSingle();

      // Guest orders never created an attendance row, so there is none to cancel.
      if (order?.buyer_user_id) {
        await admin
          .from("jam_rsvps")
          .update({ status: "cancelled", waitlist_position: null })
          .eq("jam_id", order.jam_id)
          .eq("user_id", order.buyer_user_id);
      }
      break;
    }

    case "charge.dispute.created": {
      // Recorded but not acted on — voiding a ticket automatically on a dispute
      // would let a chargeback cancel someone's entry before it is resolved.
      break;
    }
  }

  return NextResponse.json({ received: true });
}
