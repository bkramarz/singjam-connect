import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseFromBearer } from "@/lib/supabase/bearer";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";

// Host management of an event's promotion codes. Creating one makes a Stripe
// coupon plus promotion code, then records the jam association locally — Stripe
// codes are account-wide, so the association is what stops a code being
// redeemable on somebody else's event.
//
// Note the plural path: ../promo is the buyer-facing preview.

type Auth =
  | { ok: true; user: { id: string }; admin: ReturnType<typeof supabaseAdmin> }
  | { ok: false; response: NextResponse };

async function authorize(req: Request, jamId: string): Promise<Auth> {
  const supabase = await supabaseServer();
  let user = (await supabase.auth.getUser()).data.user ?? null;
  if (!user) {
    const bearer = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (bearer) user = (await supabaseFromBearer(bearer).auth.getUser()).data.user ?? null;
  }
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const admin = supabaseAdmin();
  const { data: jam } = await admin.from("jams").select("host_user_id").eq("id", jamId).maybeSingle();
  if (!jam) {
    return { ok: false, response: NextResponse.json({ error: "Jam not found" }, { status: 404 }) };
  }
  if (jam.host_user_id !== user.id) {
    const { data: cohost } = await admin
      .from("jam_cohosts")
      .select("id")
      .eq("jam_id", jamId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!cohost) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Only the host can manage promo codes" }, { status: 403 }),
      };
    }
  }
  return { ok: true, user, admin };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: jamId } = await params;
  const auth = await authorize(req, jamId);
  if (!auth.ok) return auth.response;

  const { data: rows } = await auth.admin
    .from("ticket_promo_codes")
    .select("id, code, label, stripe_promotion_code_id, created_at")
    .eq("jam_id", jamId)
    .order("created_at", { ascending: false });

  // Redemption counts live in Stripe, so read them from there rather than
  // duplicating a counter we'd have to keep in step.
  const codes = await Promise.all(
    (rows ?? []).map(async (r) => {
      let redeemed: number | null = null;
      try {
        const p = await stripe().promotionCodes.retrieve(r.stripe_promotion_code_id);
        redeemed = p.times_redeemed ?? 0;
      } catch {
        // A code deleted directly in the Dashboard shouldn't break the page.
        redeemed = null;
      }
      return { id: r.id, code: r.code, label: r.label, redeemed };
    })
  );

  return NextResponse.json({ promo_codes: codes });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: jamId } = await params;
  const auth = await authorize(req, jamId);
  if (!auth.ok) return auth.response;
  const { user, admin } = auth;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Codes are matched case-insensitively by Stripe, so normalise for storage and
  // display rather than letting "save10" and "SAVE10" look like different codes.
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) {
    return NextResponse.json(
      { error: "Use 3–40 letters, numbers, dashes or underscores" },
      { status: 400 }
    );
  }

  const percentOff = body?.percent_off != null ? Number(body.percent_off) : null;
  const amountOffCents = body?.amount_off_cents != null ? Number(body.amount_off_cents) : null;

  if (percentOff == null && amountOffCents == null) {
    return NextResponse.json({ error: "Set a percentage or an amount off" }, { status: 400 });
  }
  if (percentOff != null && amountOffCents != null) {
    return NextResponse.json({ error: "Set either a percentage or an amount, not both" }, { status: 400 });
  }
  if (percentOff != null && (!(percentOff > 0) || percentOff > 100)) {
    return NextResponse.json({ error: "Percentage must be between 1 and 100" }, { status: 400 });
  }
  if (amountOffCents != null && (!Number.isInteger(amountOffCents) || amountOffCents <= 0)) {
    return NextResponse.json({ error: "Amount must be a positive whole number of cents" }, { status: 400 });
  }

  // Check our own uniqueness first so a duplicate is a clear message rather than
  // a Stripe error, and so we don't leave an orphaned coupon behind on failure.
  const { data: clash } = await admin
    .from("ticket_promo_codes")
    .select("id, jam_id")
    .ilike("code", code)
    .maybeSingle();
  if (clash) {
    return NextResponse.json(
      {
        error:
          clash.jam_id === jamId
            ? "That code already exists for this event"
            : "That code is already used by another event",
      },
      { status: 409 }
    );
  }

  // The tier currency, so a fixed-amount coupon matches what tickets are priced in.
  const { data: tier } = await admin
    .from("ticket_types")
    .select("currency")
    .eq("jam_id", jamId)
    .limit(1)
    .maybeSingle();
  const currency = tier?.currency ?? "usd";

  let couponId: string | null = null;
  try {
    const coupon = await stripe().coupons.create(
      percentOff != null
        ? { percent_off: percentOff, duration: "once", name: `${code} (${jamId.slice(0, 8)})` }
        : { amount_off: amountOffCents!, currency, duration: "once", name: `${code} (${jamId.slice(0, 8)})` }
    );
    couponId = coupon.id;

    const promo = await stripe().promotionCodes.create({
      promotion: { type: "coupon", coupon: coupon.id }, // a bare `coupon` param is rejected
      code,
    });

    const label =
      percentOff != null
        ? `${percentOff}% off`
        : `${new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currency.toUpperCase(),
          }).format(amountOffCents! / 100)} off`;

    const { data: row, error } = await admin
      .from("ticket_promo_codes")
      .insert({
        jam_id: jamId,
        code,
        stripe_promotion_code_id: promo.id,
        stripe_coupon_id: coupon.id,
        label,
        created_by: user.id,
      })
      .select("id, code, label")
      .single();

    if (error) {
      // Our row is what scopes the code to this event. Without it the Stripe code
      // would exist and be redeemable nowhere — so retire it rather than leaving
      // an unusable code occupying the name.
      await stripe().promotionCodes.update(promo.id, { active: false }).catch(() => {});
      await stripe().coupons.del(coupon.id).catch(() => {});
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ...row, redeemed: 0 });
  } catch (e: any) {
    if (couponId) await stripe().coupons.del(couponId).catch(() => {});
    // Stripe rejects a duplicate active code even if our table missed it — for
    // instance one created by hand in the Dashboard.
    const msg = /already exists|already active/i.test(e?.message ?? "")
      ? "That code already exists in Stripe"
      : "Could not create that code";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: jamId } = await params;
  const auth = await authorize(req, jamId);
  if (!auth.ok) return auth.response;
  const { admin } = auth;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data: row } = await admin
    .from("ticket_promo_codes")
    .select("id, stripe_promotion_code_id, stripe_coupon_id")
    .eq("id", id)
    .eq("jam_id", jamId)
    .maybeSingle();

  if (!row) return NextResponse.json({ error: "Code not found" }, { status: 404 });

  // Deactivate rather than delete in Stripe: paid orders reference the coupon,
  // and deleting it would break their record. Deactivating stops new redemptions
  // and frees the code name for reuse.
  await stripe()
    .promotionCodes.update(row.stripe_promotion_code_id, { active: false })
    .catch(() => {});

  await admin.from("ticket_promo_codes").delete().eq("id", row.id);
  return NextResponse.json({ ok: true });
}
