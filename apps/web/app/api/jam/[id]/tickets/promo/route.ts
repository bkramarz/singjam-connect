import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";

// Previews a promotion code so the buyer sees success/failure and their real
// total BEFORE committing to pay.
//
// This is a PREVIEW, not the charge. Stripe applies the discount when the
// Checkout Session is created and its amount_total is authoritative — the
// webhook reconciles ticket_orders.amount_cents to it. The arithmetic here only
// exists so the UI can show a number, and it deliberately reserves no stock and
// creates no session, so an invalid code costs nothing.

type Item = { ticket_type_id: string; quantity: number };

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: jamId } = await params;

  let code = "";
  let items: Item[] = [];
  try {
    const body = await req.json();
    code = typeof body?.code === "string" ? body.code.trim() : "";
    items = Array.isArray(body?.items) ? body.items : [];
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!code) return NextResponse.json({ error: "No code supplied" }, { status: 400 });
  if (items.length === 0) return NextResponse.json({ error: "No tickets selected" }, { status: 400 });

  const admin = supabaseAdmin();

  // Prices come from the database, never from the client.
  const { data: tiers } = await admin
    .from("ticket_types")
    .select("id, price_cents, currency")
    .eq("jam_id", jamId);

  const byId = new Map((tiers ?? []).map((t) => [t.id, t]));
  let subtotal = 0;
  let currency = "usd";
  for (const it of items) {
    const tier = byId.get(it.ticket_type_id);
    const qty = Number(it.quantity);
    if (!tier || !Number.isInteger(qty) || qty <= 0) {
      return NextResponse.json({ error: "Invalid ticket selection" }, { status: 400 });
    }
    subtotal += tier.price_cents * qty;
    currency = tier.currency;
  }

  // Resolve through OUR table, scoped to this jam. Looking the code up in Stripe
  // by name would honour any active code on the account, so a discount created
  // for one event would work on every other event's checkout.
  const { data: registered } = await admin
    .from("ticket_promo_codes")
    .select("stripe_promotion_code_id")
    .eq("jam_id", jamId)
    .ilike("code", code)
    .maybeSingle();

  const reject = (reason: string) =>
    NextResponse.json({ valid: false, reason, subtotal_cents: subtotal, currency });

  if (!registered) return reject("That code isn't valid for this event");

  let promo: any;
  try {
    promo = await stripe().promotionCodes.retrieve(registered.stripe_promotion_code_id, {
      expand: ["promotion.coupon"],
    });
  } catch {
    return NextResponse.json({ error: "Could not check that code" }, { status: 502 });
  }
  if (promo?.active === false) return reject("That code is no longer active");

  const coupon = promo.promotion?.coupon;
  if (!coupon || coupon.valid === false) return reject("That code has expired");

  if (promo.expires_at && promo.expires_at * 1000 < Date.now()) {
    return reject("That code has expired");
  }
  if (promo.max_redemptions != null && promo.times_redeemed >= promo.max_redemptions) {
    return reject("That code has been fully redeemed");
  }

  const min = promo.restrictions?.minimum_amount;
  if (min != null && subtotal < min) {
    const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() });
    return reject(`That code needs a minimum order of ${fmt.format(min / 100)}`);
  }

  // Coupons scoped to specific Stripe Products can never match our line items,
  // which are built from inline price_data rather than a Stripe catalogue. Say
  // so here instead of letting the discount silently fail at charge time.
  if (coupon.applies_to?.products?.length) {
    return reject("That code doesn't apply to tickets");
  }

  let discount = 0;
  if (typeof coupon.percent_off === "number") {
    discount = Math.round((subtotal * coupon.percent_off) / 100);
  } else if (typeof coupon.amount_off === "number") {
    // A fixed-amount coupon in another currency can't be applied to this order.
    if (coupon.currency && coupon.currency.toLowerCase() !== currency.toLowerCase()) {
      return reject("That code can't be used on this order");
    }
    discount = Math.min(coupon.amount_off, subtotal);
  } else {
    return reject("That code isn't valid");
  }

  const label =
    typeof coupon.percent_off === "number"
      ? `${coupon.percent_off}% off`
      : `${new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(
          (coupon.amount_off ?? 0) / 100
        )} off`;

  return NextResponse.json({
    valid: true,
    code: promo.code,
    label,
    subtotal_cents: subtotal,
    discount_cents: discount,
    total_cents: Math.max(0, subtotal - discount),
    currency,
  });
}
