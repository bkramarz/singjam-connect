import { describe, it, expect } from "vitest";
import { resolveTicketPaymentState, type PaymentOrder } from "./ticketPaymentState";

const NOW = new Date("2026-09-09T21:00:00Z");
const LATER = "2026-09-09T21:30:00Z"; // hold still live
const PAST = "2026-09-09T20:55:00Z"; // hold lapsed

const order = (over: Partial<PaymentOrder> = {}): PaymentOrder => ({
  status: "pending",
  amount_cents: 1576,
  currency: "usd",
  stripe_checkout_session_id: "cs_test_abc",
  expires_at: LATER,
  ...over,
});

const openSession = { status: "open", client_secret: "cs_test_abc_secret_xyz", amount_total: 1576 };

describe("resolveTicketPaymentState", () => {
  it("pays when the order is held and the session is open", () => {
    expect(resolveTicketPaymentState(order(), openSession, NOW)).toEqual({
      kind: "pay",
      clientSecret: "cs_test_abc_secret_xyz",
      amountCents: 1576,
      currency: "usd",
    });
  });

  it("charges the session's total, not the order's subtotal", () => {
    // The order row holds the ticket price; the cover-the-fee amount is a
    // separate line item on the session. Showing the order's number put $15.00
    // in the header while Stripe's own Pay button said $15.76.
    const state = resolveTicketPaymentState(order({ amount_cents: 1500 }), openSession, NOW);
    expect(state).toMatchObject({ kind: "pay", amountCents: 1576 });
  });

  it("falls back to the order subtotal if the session has no total", () => {
    const state = resolveTicketPaymentState(
      order({ amount_cents: 1500 }),
      { ...openSession, amount_total: null },
      NOW
    );
    expect(state).toMatchObject({ kind: "pay", amountCents: 1500 });
  });

  it("is safe to reload — the same inputs resolve the same way every time", () => {
    const o = order();
    const first = resolveTicketPaymentState(o, openSession, NOW);
    const second = resolveTicketPaymentState(o, openSession, NOW);
    expect(second).toEqual(first);
  });

  it("sends a paid order to the receipt, whatever the session says", () => {
    expect(resolveTicketPaymentState(order({ status: "paid" }), null, NOW).kind).toBe("done");
    expect(
      resolveTicketPaymentState(order({ status: "paid" }), { status: "open", client_secret: "x", amount_total: 1576 }, NOW).kind
    ).toBe("done");
    expect(resolveTicketPaymentState(order({ status: "refunded" }), null, NOW).kind).toBe("done");
  });

  it("treats a completed session as done even before the webhook lands", () => {
    // The order is still 'pending' here; the receipt page calls that
    // "confirming". Showing a card form instead would invite a second payment.
    const state = resolveTicketPaymentState(order(), { status: "complete", client_secret: null, amount_total: 1576 }, NOW);
    expect(state.kind).toBe("done");
  });

  it("refuses to take payment once the inventory hold has lapsed", () => {
    // The stock may already have been resold, so an open Stripe session is not
    // enough — the database is the authority on inventory.
    const state = resolveTicketPaymentState(order({ expires_at: PAST }), openSession, NOW);
    expect(state.kind).toBe("expired");
  });

  it("treats the exact expiry instant as lapsed", () => {
    const state = resolveTicketPaymentState(
      order({ expires_at: NOW.toISOString() }),
      openSession,
      NOW
    );
    expect(state.kind).toBe("expired");
  });

  it("expires a failed or already-expired order", () => {
    for (const status of ["failed", "expired"]) {
      expect(resolveTicketPaymentState(order({ status }), openSession, NOW).kind).toBe("expired");
    }
  });

  it("expires when the session cannot be read or was never created", () => {
    expect(resolveTicketPaymentState(order(), null, NOW).kind).toBe("expired");
    expect(
      resolveTicketPaymentState(order({ stripe_checkout_session_id: null }), null, NOW).kind
    ).toBe("expired");
  });

  it("expires an expired session, and an open one with no secret", () => {
    expect(
      resolveTicketPaymentState(order(), { status: "expired", client_secret: null, amount_total: null }, NOW).kind
    ).toBe("expired");
    expect(
      resolveTicketPaymentState(order(), { status: "open", client_secret: null, amount_total: 1576 }, NOW).kind
    ).toBe("expired");
  });
});
