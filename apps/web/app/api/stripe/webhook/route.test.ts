import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAdminFrom, mockConstructEvent, mockSend, mockGetUserById } = vi.hoisted(() => ({
  mockAdminFrom: vi.fn(),
  mockConstructEvent: vi.fn(),
  mockSend: vi.fn().mockResolvedValue({}),
  mockGetUserById: vi.fn().mockResolvedValue({ data: { user: { email: "member@singjam.org" } } }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: vi.fn(() => ({
    from: mockAdminFrom,
    auth: { admin: { getUserById: mockGetUserById } },
  })),
}));
vi.mock("@/lib/stripe", () => ({
  // A factory, matching the lazy client in lib/stripe.ts.
  stripe: () => ({ webhooks: { constructEvent: mockConstructEvent } }),
  SITE_URL: "https://singjam.org",
}));
vi.mock("@/lib/resend", () => ({
  resend: { emails: { send: mockSend } },
  FROM_ADDRESS: "test@singjam.org",
}));
vi.mock("@/emails/ticket-confirmation", () => ({
  ticketConfirmationHtml: vi.fn(() => "<html>"),
}));

import { POST } from "./route";

function chain(result: any) {
  const c: any = {};
  for (const m of ["select", "eq", "update", "insert"]) {
    c[m] = vi.fn().mockReturnValue(c);
  }
  c.single = vi.fn().mockResolvedValue(result);
  c.maybeSingle = vi.fn().mockResolvedValue(result);
  c.then = (resolve: any) => Promise.resolve(result).then(resolve);
  return c;
}

const ORDER_ID = "order-1";
const JAM_ID = "jam-1";
const BUYER_ID = "user-1";

function paidOrder(over: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    jam_id: JAM_ID,
    buyer_user_id: BUYER_ID,
    buyer_email: "buyer@example.com",
    buyer_name: "Buyer",
    amount_cents: 3000,
    currency: "usd",
    ticket_email_sent_at: null,
    ...over,
  };
}

// The confirmation email reads the jam and the order's tickets, then stamps the
// order so a redelivery can't send twice.
function emailChains() {
  mockAdminFrom
    .mockReturnValueOnce(chain({ data: { name: "Winter Sing", starts_at: null } })) // jams
    .mockReturnValueOnce(chain({ data: [{ qr_token: "abc-def", ticket_types: { name: "General" } }] })) // tickets
    .mockReturnValueOnce(chain({ error: null })); // stamp ticket_email_sent_at
}

function makeReq(signed = true) {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: signed ? { "stripe-signature": "sig" } : {},
    body: "{}",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/stripe/webhook", () => {
  it("rejects a request with no signature header", async () => {
    const res = await POST(makeReq(false));
    expect(res.status).toBe(400);
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });

  it("rejects a forged payload whose signature does not verify", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("bad sig");
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(400);
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it("marks the order paid and records attendance on checkout.session.completed", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          payment_status: "paid",
          payment_intent: "pi_1",
          metadata: { order_id: ORDER_ID },
        },
      },
    });
    mockAdminFrom.mockReturnValueOnce(chain({ data: paidOrder() })); // order update
    emailChains();
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: null })) // existing rsvp lookup
      .mockReturnValueOnce(chain({ error: null })); // rsvp insert

    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const orderChain = mockAdminFrom.mock.results[0].value;
    expect(orderChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "paid", stripe_payment_intent_id: "pi_1" })
    );
    // The pending guard is what makes redelivery a no-op.
    expect(orderChain.eq).toHaveBeenCalledWith("status", "pending");

    const rsvpChain = mockAdminFrom.mock.results[5].value;
    expect(rsvpChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ jam_id: JAM_ID, user_id: BUYER_ID, status: "attending" })
    );

    // The buyer gets their ticket.
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0]).toMatchObject({ to: "buyer@example.com" });
  });

  it("fulfils a guest order without trying to write an attendance row", async () => {
    // jam_rsvps.user_id is NOT NULL and references profiles, so a guest order
    // has nothing to attach attendance to — the order and tickets are the record.
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { payment_status: "paid", payment_intent: "pi_1", metadata: { order_id: ORDER_ID } } },
    });
    mockAdminFrom.mockReturnValueOnce(
      chain({ data: paidOrder({ buyer_user_id: null, buyer_email: "guest@example.com" }) })
    );
    emailChains();

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(mockAdminFrom.mock.results[0].value.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "paid" })
    );
    // The guest still gets their ticket — it's their only copy.
    expect(mockSend.mock.calls[0][0]).toMatchObject({ to: "guest@example.com" });
    // Order update + 3 email calls, and nothing more: no jam_rsvps work.
    expect(mockAdminFrom).toHaveBeenCalledTimes(4);
  });

  it("does not re-send the ticket when Stripe redelivers", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { payment_status: "paid", payment_intent: "pi_1", metadata: { order_id: ORDER_ID } } },
    });
    // A stamped order means the email already went out.
    mockAdminFrom.mockReturnValueOnce(
      chain({ data: paidOrder({ buyer_user_id: null, ticket_email_sent_at: "2026-08-07T00:00:00Z" }) })
    );

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("still marks the order paid when the confirmation email fails", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { payment_status: "paid", payment_intent: "pi_1", metadata: { order_id: ORDER_ID } } },
    });
    mockAdminFrom.mockReturnValueOnce(chain({ data: paidOrder({ buyer_user_id: null }) }));
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { name: "Winter Sing", starts_at: null } }))
      .mockReturnValueOnce(chain({ data: [{ qr_token: "abc", ticket_types: { name: "General" } }] }));
    mockSend.mockRejectedValueOnce(new Error("resend down"));

    const res = await POST(makeReq());
    // A mail outage must not fail the webhook — Stripe would retry an already
    // correctly-paid order. The unstamped row is the sweeper's work queue.
    expect(res.status).toBe(200);
    expect(mockAdminFrom.mock.results[0].value.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "paid" })
    );
  });

  it("refunds a guest order without touching attendance", async () => {
    mockConstructEvent.mockReturnValue({
      type: "charge.refunded",
      data: { object: { payment_intent: "pi_1", amount: 3000, amount_refunded: 3000 } },
    });
    mockAdminFrom.mockReturnValueOnce(
      chain({ data: { id: ORDER_ID, jam_id: JAM_ID, buyer_user_id: null } })
    );

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(mockAdminFrom).toHaveBeenCalledTimes(1);
  });

  it("does not fulfil when a delayed payment method reports completed but unpaid", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { payment_status: "unpaid", metadata: { order_id: ORDER_ID } } },
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it("is a no-op on redelivery once the order is no longer pending", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { payment_status: "paid", payment_intent: "pi_1", metadata: { order_id: ORDER_ID } } },
    });
    // The guarded update matches nothing the second time around.
    mockAdminFrom.mockReturnValueOnce(chain({ data: null }));

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    // No RSVP writes followed.
    expect(mockAdminFrom).toHaveBeenCalledTimes(1);
  });

  it("promotes an existing waitlist row instead of inserting a duplicate", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { payment_status: "paid", payment_intent: "pi_1", metadata: { order_id: ORDER_ID } } },
    });
    mockAdminFrom.mockReturnValueOnce(chain({ data: paidOrder() }));
    emailChains();
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { id: "rsvp-9" } })) // already has a row
      .mockReturnValueOnce(chain({ error: null }));

    await POST(makeReq());
    const rsvpChain = mockAdminFrom.mock.results[5].value;
    expect(rsvpChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "attending", waitlist_position: null })
    );
    expect(rsvpChain.insert).not.toHaveBeenCalled();
  });

  it("expires the order and releases the hold on checkout.session.expired", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.expired",
      data: { object: { metadata: { order_id: ORDER_ID } } },
    });
    mockAdminFrom.mockReturnValueOnce(chain({ error: null }));

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const c = mockAdminFrom.mock.results[0].value;
    expect(c.update).toHaveBeenCalledWith(expect.objectContaining({ status: "expired" }));
    expect(c.eq).toHaveBeenCalledWith("status", "pending");
  });

  it("voids the order and cancels attendance on a full refund", async () => {
    mockConstructEvent.mockReturnValue({
      type: "charge.refunded",
      data: { object: { payment_intent: "pi_1", amount: 3000, amount_refunded: 3000 } },
    });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { id: ORDER_ID, jam_id: JAM_ID, buyer_user_id: BUYER_ID } }))
      .mockReturnValueOnce(chain({ error: null }));

    await POST(makeReq());
    expect(mockAdminFrom.mock.results[0].value.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "refunded" })
    );
    expect(mockAdminFrom.mock.results[1].value.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled" })
    );
  });

  it("leaves tickets valid on a partial refund", async () => {
    mockConstructEvent.mockReturnValue({
      type: "charge.refunded",
      data: { object: { payment_intent: "pi_1", amount: 3000, amount_refunded: 500 } },
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it("does not void a ticket when a dispute is opened", async () => {
    mockConstructEvent.mockReturnValue({
      type: "charge.dispute.created",
      data: { object: { payment_intent: "pi_1" } },
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });
});
