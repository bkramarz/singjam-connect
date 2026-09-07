import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAdminFrom, mockPromoRetrieve } = vi.hoisted(() => ({
  mockAdminFrom: vi.fn(),
  mockPromoRetrieve: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: vi.fn(() => ({ from: mockAdminFrom })),
}));
vi.mock("@/lib/stripe", () => ({
  stripe: () => ({ promotionCodes: { retrieve: mockPromoRetrieve } }),
}));

import { POST } from "./route";

function chain(result: any) {
  const c: any = {};
  for (const m of ["select", "eq", "ilike"]) c[m] = vi.fn().mockReturnValue(c);
  c.maybeSingle = vi.fn().mockResolvedValue(result);
  c.then = (resolve: any) => Promise.resolve(result).then(resolve);
  return c;
}

const JAM_ID = "jam-1";
const TYPE = "type-1";
const params = { params: Promise.resolve({ id: JAM_ID }) };

// Two $15 tickets = $30 subtotal.
const req = (body: any) =>
  new Request(`http://localhost/api/jam/${JAM_ID}/tickets/promo`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const TWO_TICKETS = { code: "SAVE", items: [{ ticket_type_id: TYPE, quantity: 2 }] };

function tiers(registered = true) {
  mockAdminFrom
    .mockReturnValueOnce(chain({ data: [{ id: TYPE, price_cents: 1500, currency: "usd" }] }))
    .mockReturnValueOnce(
      chain({ data: registered ? { stripe_promotion_code_id: "promo_1" } : null })
    );
}
function promo(over: any = {}) {
  mockPromoRetrieve.mockResolvedValue(
      {
        code: "SAVE",
        active: true,
        expires_at: null,
        max_redemptions: null,
        times_redeemed: 0,
        restrictions: {},
        promotion: { coupon: { valid: true, percent_off: 25 } },
        ...over,
      }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/jam/[id]/tickets/promo", () => {
  it("previews a percentage discount against server-side prices", async () => {
    tiers();
    promo();
    const json = await (await POST(req(TWO_TICKETS), params)).json();
    expect(json).toMatchObject({
      valid: true,
      code: "SAVE",
      label: "25% off",
      subtotal_cents: 3000,
      discount_cents: 750,
      total_cents: 2250,
    });
  });

  it("previews a fixed-amount discount", async () => {
    tiers();
    promo({ promotion: { coupon: { valid: true, amount_off: 500, currency: "usd" } } });
    const json = await (await POST(req(TWO_TICKETS), params)).json();
    expect(json).toMatchObject({ valid: true, label: "$5.00 off", discount_cents: 500, total_cents: 2500 });
  });

  it("never lets a fixed discount exceed the order, or the total go negative", async () => {
    tiers();
    promo({ promotion: { coupon: { valid: true, amount_off: 99999, currency: "usd" } } });
    const json = await (await POST(req(TWO_TICKETS), params)).json();
    expect(json.discount_cents).toBe(3000);
    expect(json.total_cents).toBe(0);
  });

  it("reports a code not registered for this event as invalid, not an error", async () => {
    tiers(false);
    const res = await POST(req(TWO_TICKETS), params);
    // A rejected code is a successful answer of "no" — the UI shows it inline.
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ valid: false, reason: expect.stringMatching(/this event/i) });
    // Never reaches Stripe — the code simply isn't ours to honour here.
    expect(mockPromoRetrieve).not.toHaveBeenCalled();
  });

  it("refuses another event's code — codes must not leak across events", async () => {
    // The code exists and is active in Stripe, but has no row for this jam.
    tiers(false);
    mockPromoRetrieve.mockResolvedValue({ code: "SAVE", active: true, promotion: { coupon: { valid: true, percent_off: 90 } } });
    const json = await (await POST(req(TWO_TICKETS), params)).json();
    expect(json.valid).toBe(false);
    expect(mockPromoRetrieve).not.toHaveBeenCalled();
  });

  it("rejects a code that has been deactivated", async () => {
    tiers();
    promo({ active: false });
    const json = await (await POST(req(TWO_TICKETS), params)).json();
    expect(json).toMatchObject({ valid: false, reason: expect.stringMatching(/no longer active/i) });
  });

  it("rejects a code below its minimum order, quoting the minimum", async () => {
    tiers();
    promo({ restrictions: { minimum_amount: 5000, minimum_amount_currency: "usd" } });
    const json = await (await POST(req(TWO_TICKETS), params)).json();
    expect(json.valid).toBe(false);
    expect(json.reason).toContain("$50.00");
  });

  it("rejects an expired code", async () => {
    tiers();
    promo({ expires_at: Math.floor(Date.now() / 1000) - 60 });
    const json = await (await POST(req(TWO_TICKETS), params)).json();
    expect(json).toMatchObject({ valid: false, reason: expect.stringMatching(/expired/i) });
  });

  it("rejects a fully redeemed code", async () => {
    tiers();
    promo({ max_redemptions: 5, times_redeemed: 5 });
    const json = await (await POST(req(TWO_TICKETS), params)).json();
    expect(json).toMatchObject({ valid: false, reason: expect.stringMatching(/redeemed/i) });
  });

  it("rejects a product-scoped coupon, which can never match inline line items", async () => {
    tiers();
    promo({
      promotion: { coupon: { valid: true, percent_off: 25, applies_to: { products: ["prod_1"] } } },
    });
    const json = await (await POST(req(TWO_TICKETS), params)).json();
    expect(json).toMatchObject({ valid: false, reason: expect.stringMatching(/doesn't apply/i) });
  });

  it("rejects a fixed-amount coupon in the wrong currency", async () => {
    tiers();
    promo({ promotion: { coupon: { valid: true, amount_off: 500, currency: "eur" } } });
    const json = await (await POST(req(TWO_TICKETS), params)).json();
    expect(json.valid).toBe(false);
  });

  it("ignores client-supplied prices, pricing from the database", async () => {
    tiers();
    promo();
    // A tampered price must not change the computed subtotal.
    const json = await (
      await POST(req({ code: "SAVE", items: [{ ticket_type_id: TYPE, quantity: 2, price_cents: 1 }] }), params)
    ).json();
    expect(json.subtotal_cents).toBe(3000);
  });

  it("rejects a ticket type that isn't on this jam", async () => {
    tiers();
    const res = await POST(req({ code: "SAVE", items: [{ ticket_type_id: "other", quantity: 1 }] }), params);
    expect(res.status).toBe(400);
    expect(mockPromoRetrieve).not.toHaveBeenCalled();
  });

  it("requires a code and a selection", async () => {
    expect((await POST(req({ items: [] }), params)).status).toBe(400);
    expect((await POST(req({ code: "SAVE", items: [] }), params)).status).toBe(400);
  });
});
