import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolvePromoCode } from "@/lib/promoCode";

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

  const resolved = await resolvePromoCode(admin, jamId, code, subtotal, currency);

  if ("error" in resolved) {
    return NextResponse.json({ error: "Could not check that code" }, { status: 502 });
  }
  if (!resolved.valid) {
    return NextResponse.json({ valid: false, reason: resolved.reason, subtotal_cents: subtotal, currency });
  }

  return NextResponse.json({
    valid: true,
    code: resolved.code,
    label: resolved.label,
    subtotal_cents: subtotal,
    discount_cents: resolved.discountCents,
    total_cents: resolved.totalCents,
    currency,
  });
}
