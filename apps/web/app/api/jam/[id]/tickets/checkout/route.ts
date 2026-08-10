import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseFromBearer } from "@/lib/supabase/bearer";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  stripe,
  SITE_URL,
  TICKET_INTEGRATION_ID,
  HOLD_MINUTES,
  SESSION_EXPIRY_MINUTES,
  EXCLUDED_PAYMENT_METHODS,
} from "@/lib/stripe";

type Item = { ticket_type_id: string; quantity: number };

// Deliberately permissive. Stripe validates the address properly when the
// session is completed; this only catches obvious typos before we reserve stock.
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// Frees reserved stock straight away instead of making the buyer wait out the
// hold window for tickets they never got a chance to pay for.
async function releaseHold(admin: ReturnType<typeof supabaseAdmin>, orderId: string) {
  await admin
    .from("ticket_orders")
    .update({ status: "failed", updated_at: new Date().toISOString() })
    .eq("id", orderId);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jamId } = await params;

  const supabase = await supabaseServer();
  let user = (await supabase.auth.getUser()).data.user ?? null;
  if (!user) {
    // Native app authenticates with a bearer token instead of cookies
    const bearer = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (bearer) user = (await supabaseFromBearer(bearer).auth.getUser()).data.user ?? null;
  }

  let items: Item[];
  let guestEmail = "";
  let guestName = "";
  let promoCode = "";
  try {
    const body = await req.json();
    items = Array.isArray(body?.items) ? body.items : [];
    guestEmail = typeof body?.email === "string" ? body.email.trim() : "";
    guestName = typeof body?.name === "string" ? body.name.trim() : "";
    promoCode = typeof body?.promo_code === "string" ? body.promo_code.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (items.length === 0) {
    return NextResponse.json({ error: "No tickets selected" }, { status: 400 });
  }

  // Buying a ticket does not require an account — most people arrive from a
  // shared link and won't sign up to buy. Guests are identified by email, which
  // is also where their ticket goes, so it is the one thing we must insist on.
  const buyerEmail = user?.email ?? guestEmail;
  if (!user && !isEmail(guestEmail)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  const { data: jam } = await admin
    .from("jams")
    .select("id, name, visibility")
    .eq("id", jamId)
    .single();
  if (!jam) return NextResponse.json({ error: "Jam not found" }, { status: 404 });

  // Paid ticketing is the official-event path. Community and private jams keep
  // the free RSVP flow in ../rsvp/route.ts.
  if (jam.visibility !== "official") {
    return NextResponse.json({ error: "This event does not sell tickets" }, { status: 400 });
  }

  // Reserve stock first. Doing this before creating the Stripe session is what
  // stops us collecting money for a sold-out tier — the reverse order would
  // hand the buyer a payable session against stock that may already be gone.
  const { data: orderId, error: reserveError } = await admin.rpc("reserve_ticket_order", {
    jam_id_param: jamId,
    buyer_param: user?.id ?? null,
    items,
    hold_minutes: HOLD_MINUTES,
    buyer_email_param: buyerEmail || null,
    buyer_name_param: guestName || null,
  });

  if (reserveError || !orderId) {
    // The RPC raises human-readable messages ("only 1 left of General").
    return NextResponse.json(
      { error: reserveError?.message ?? "Could not reserve tickets" },
      { status: 409 }
    );
  }

  const { data: order } = await admin
    .from("ticket_orders")
    .select("id, amount_cents, currency")
    .eq("id", orderId)
    .single();

  const { data: lines } = await admin
    .from("tickets")
    .select("ticket_type_id, ticket_types(name, price_cents, currency)")
    .eq("order_id", orderId);

  // Collapse the per-ticket rows back into one Stripe line item per tier.
  const byType = new Map<string, { name: string; price_cents: number; currency: string; qty: number }>();
  for (const row of lines ?? []) {
    const t = (row as any).ticket_types;
    const key = (row as any).ticket_type_id;
    const existing = byType.get(key);
    if (existing) existing.qty += 1;
    else byType.set(key, { name: t.name, price_cents: t.price_cents, currency: t.currency, qty: 1 });
  }

  // Promotion codes live in Stripe, not in our schema — Stripe applies the
  // discount and its amount_total is authoritative. ui_mode 'elements' has no
  // built-in code field, so the code is resolved here and attached to the
  // session; allow_promotion_codes only applies to Stripe-rendered checkout.
  let discounts: { promotion_code: string }[] | undefined;
  if (promoCode) {
    // Resolved through ticket_promo_codes, scoped to this jam. A Stripe lookup by
    // code name would honour any active code on the account, letting a discount
    // made for one event be redeemed on every other event.
    const { data: registered } = await admin
      .from("ticket_promo_codes")
      .select("stripe_promotion_code_id")
      .eq("jam_id", jamId)
      .ilike("code", promoCode)
      .maybeSingle();

    if (!registered) {
      await releaseHold(admin, order!.id);
      return NextResponse.json({ error: "That promo code isn't valid for this event" }, { status: 400 });
    }
    discounts = [{ promotion_code: registered.stripe_promotion_code_id }];
  }

  try {
    const session = await stripe().checkout.sessions.create({
      // 'elements' backs the embedded Payment Element with a Checkout Session
      // rather than a raw PaymentIntent, which is what keeps automatic_tax,
      // discounts and adaptive pricing available as configuration later. The
      // enum is elements | embedded_page | hosted_page — there is no 'custom'
      // value, despite older prose calling this flow "custom checkout" (the
      // name survives only in the Stripe.js namespace, js/custom_checkout/*).
      ui_mode: "elements",
      mode: "payment",
      // payment_method_types is deliberately omitted — that enables dynamic
      // payment methods, managed from the Dashboard with no code change.
      // Hardcoding ['card'] would suppress wallets and hurt conversion.
      // Narrowing happens through exclusion instead, which keeps the rest dynamic.
      excluded_payment_method_types: [...EXCLUDED_PAYMENT_METHODS],
      ...(discounts ? { discounts } : {}),
      integration_identifier: TICKET_INTEGRATION_ID,
      client_reference_id: order!.id,
      metadata: { order_id: order!.id, jam_id: jamId, buyer_user_id: user?.id ?? "" },
      // A valid email is required to complete a Checkout Session. Members are
      // already signed in and guests supplied one above, so it is always known —
      // which is what lets the form be payment fields only, with no contact step.
      ...(buyerEmail ? { customer_email: buyerEmail } : {}),
      // Required for ui_mode 'elements' once any redirect-based payment method
      // is enabled — and dynamic payment methods mean we cannot assume none is.
      return_url: `${SITE_URL}/jam/${jamId}/tickets/complete?session_id={CHECKOUT_SESSION_ID}`,
      // 30 minutes is Stripe's floor for expires_at, and is deliberately shorter
      // than the database hold so the session always dies first. See lib/stripe.ts.
      expires_at: Math.floor(Date.now() / 1000) + SESSION_EXPIRY_MINUTES * 60,
      line_items: [...byType.values()].map((l) => ({
        quantity: l.qty,
        price_data: {
          currency: l.currency,
          unit_amount: l.price_cents,
          product_data: { name: `${jam.name ?? "Event"} — ${l.name}` },
        },
      })),
    });

    await admin
      .from("ticket_orders")
      .update({ stripe_checkout_session_id: session.id, updated_at: new Date().toISOString() })
      .eq("id", order!.id);

    return NextResponse.json({
      order_id: order!.id,
      client_secret: session.client_secret,
      amount_cents: order!.amount_cents,
      currency: order!.currency,
    });
  } catch (e: any) {
    // Release the hold immediately rather than making the buyer wait out the
    // expiry window for stock they never got a chance to pay for.
    await admin
      .from("ticket_orders")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", order!.id);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 502 });
  }
}
