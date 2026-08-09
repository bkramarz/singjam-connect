import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockBearerGetUser, mockAdminFrom, mockRpc, mockSessionsCreate } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockBearerGetUser: vi.fn(),
  mockAdminFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockSessionsCreate: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
}));
vi.mock("@/lib/supabase/bearer", () => ({
  supabaseFromBearer: vi.fn(() => ({ auth: { getUser: mockBearerGetUser } })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: vi.fn(() => ({ from: mockAdminFrom, rpc: mockRpc })),
}));
vi.mock("@/lib/stripe", () => ({
  // A factory, matching the lazy client in lib/stripe.ts.
  stripe: () => ({ checkout: { sessions: { create: mockSessionsCreate } } }),
  SITE_URL: "https://singjam.org",
  TICKET_INTEGRATION_ID: "singjam_tickets_qxwmvpht",
  SESSION_EXPIRY_MINUTES: 30,
  HOLD_MINUTES: 35,
  EXCLUDED_PAYMENT_METHODS: ["klarna", "affirm", "afterpay_clearpay"],
}));

import { POST } from "./route";

function chain(result: any) {
  const c: any = {};
  for (const m of ["select", "eq", "update", "insert", "order", "limit"]) {
    c[m] = vi.fn().mockReturnValue(c);
  }
  c.single = vi.fn().mockResolvedValue(result);
  c.maybeSingle = vi.fn().mockResolvedValue(result);
  c.then = (resolve: any) => Promise.resolve(result).then(resolve);
  return c;
}

const JAM_ID = "jam-1";
const USER_ID = "user-1";
const ORDER_ID = "order-1";
const TYPE_ID = "type-1";

function makeReq(body: any, headers: Record<string, string> = {}) {
  return new Request(`http://localhost/api/jam/${JAM_ID}/tickets/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const params = { params: Promise.resolve({ id: JAM_ID }) };
const ONE_TICKET = { items: [{ ticket_type_id: TYPE_ID, quantity: 1 }] };

// jams → ticket_orders(select) → tickets(select) → ticket_orders(update)
function happyPathDb() {
  mockAdminFrom
    .mockReturnValueOnce(chain({ data: { id: JAM_ID, name: "Winter Sing", visibility: "official" } }))
    .mockReturnValueOnce(chain({ data: { id: ORDER_ID, amount_cents: 3000, currency: "usd" } }))
    .mockReturnValueOnce(
      chain({
        data: [
          { ticket_type_id: TYPE_ID, ticket_types: { name: "General", price_cents: 1500, currency: "usd" } },
          { ticket_type_id: TYPE_ID, ticket_types: { name: "General", price_cents: 1500, currency: "usd" } },
        ],
      })
    )
    .mockReturnValueOnce(chain({ error: null }));
  mockRpc.mockResolvedValue({ data: ORDER_ID, error: null });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/jam/[id]/tickets/checkout", () => {
  it("rejects an anonymous buyer with no email, rather than 401ing them", async () => {
    // Guest checkout is allowed, so the gate is a usable email, not an account.
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeReq(ONE_TICKET), params);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/email/i);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("rejects a malformed guest email before reserving stock", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeReq({ ...ONE_TICKET, email: "not-an-email" }), params);
    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("lets a guest with no account buy tickets", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    happyPathDb();
    mockSessionsCreate.mockResolvedValue({ id: "cs_1", client_secret: "cs_secret" });

    const res = await POST(
      makeReq({ ...ONE_TICKET, email: "guest@example.com", name: "Jo Guest" }),
      params
    );
    expect(res.status).toBe(200);

    expect(mockRpc).toHaveBeenCalledWith(
      "reserve_ticket_order",
      expect.objectContaining({
        buyer_param: null,
        buyer_email_param: "guest@example.com",
        buyer_name_param: "Jo Guest",
      })
    );
    // Stripe still needs an email to complete the session.
    expect(mockSessionsCreate.mock.calls[0][0].customer_email).toBe("guest@example.com");
  });

  it("prefers the signed-in account over any email in the body", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID, email: "member@singjam.org" } } });
    happyPathDb();
    mockSessionsCreate.mockResolvedValue({ id: "cs_1", client_secret: "cs_secret" });

    await POST(makeReq({ ...ONE_TICKET, email: "attacker@example.com" }), params);
    expect(mockRpc).toHaveBeenCalledWith(
      "reserve_ticket_order",
      expect.objectContaining({ buyer_param: USER_ID, buyer_email_param: "member@singjam.org" })
    );
    expect(mockSessionsCreate.mock.calls[0][0].customer_email).toBe("member@singjam.org");
  });

  it("authenticates via bearer token when there is no cookie session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockBearerGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    happyPathDb();
    mockSessionsCreate.mockResolvedValue({ id: "cs_1", client_secret: "cs_secret" });

    const res = await POST(makeReq(ONE_TICKET, { Authorization: "Bearer tok" }), params);
    expect(res.status).toBe(200);
  });

  it("rejects an empty selection without touching the database", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    const res = await POST(makeReq({ items: [] }), params);
    expect(res.status).toBe(400);
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it("refuses to sell tickets for a non-official jam", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockAdminFrom.mockReturnValueOnce(chain({ data: { id: JAM_ID, name: "X", visibility: "community" } }));
    const res = await POST(makeReq(ONE_TICKET), params);
    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("surfaces the sold-out reason as 409 and never creates a Stripe session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockAdminFrom.mockReturnValueOnce(chain({ data: { id: JAM_ID, name: "X", visibility: "official" } }));
    mockRpc.mockResolvedValue({ data: null, error: { message: "only 1 left of General" } });

    const res = await POST(makeReq({ items: [{ ticket_type_id: TYPE_ID, quantity: 5 }] }), params);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("only 1 left of General");
    expect(mockSessionsCreate).not.toHaveBeenCalled();
  });

  it("reserves stock before creating the Stripe session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    happyPathDb();
    const callOrder: string[] = [];
    mockRpc.mockImplementation(async () => {
      callOrder.push("reserve");
      return { data: ORDER_ID, error: null };
    });
    mockSessionsCreate.mockImplementation(async () => {
      callOrder.push("stripe");
      return { id: "cs_1", client_secret: "cs_secret" };
    });

    await POST(makeReq(ONE_TICKET), params);
    expect(callOrder).toEqual(["reserve", "stripe"]);
  });

  it("creates a custom-UI Checkout Session with dynamic payment methods", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    happyPathDb();
    mockSessionsCreate.mockResolvedValue({ id: "cs_1", client_secret: "cs_secret" });

    const res = await POST(makeReq(ONE_TICKET), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      order_id: ORDER_ID,
      client_secret: "cs_secret",
      amount_cents: 3000,
      currency: "usd",
    });

    const arg = mockSessionsCreate.mock.calls[0][0];
    // The enum has no 'custom' value; sending one is rejected outright.
    expect(arg.ui_mode).toBe("elements");
    expect(arg.mode).toBe("payment");
    expect(arg.integration_identifier).toBe("singjam_tickets_qxwmvpht");
    expect(arg.client_reference_id).toBe(ORDER_ID);
    expect(arg.metadata).toMatchObject({ order_id: ORDER_ID, jam_id: JAM_ID });
    // Hardcoding payment_method_types disables dynamic payment methods.
    expect(arg).not.toHaveProperty("payment_method_types");
    // Two ticket rows of one tier collapse into a single line item of qty 2.
    expect(arg.line_items).toHaveLength(1);
    expect(arg.line_items[0]).toMatchObject({ quantity: 2 });
    expect(arg.line_items[0].price_data).toMatchObject({ currency: "usd", unit_amount: 1500 });
    expect(arg.return_url).toContain("{CHECKOUT_SESSION_ID}");
  });

  it("excludes buy-now-pay-later without disabling dynamic payment methods", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    happyPathDb();
    mockSessionsCreate.mockResolvedValue({ id: "cs_1", client_secret: "cs_secret" });

    await POST(makeReq(ONE_TICKET), params);
    const arg = mockSessionsCreate.mock.calls[0][0];
    expect(arg.excluded_payment_method_types).toEqual(["klarna", "affirm", "afterpay_clearpay"]);
    // Exclusion is the supported lever; payment_method_types would freeze the list.
    expect(arg).not.toHaveProperty("payment_method_types");
  });

  it("prefills the signed-in buyer's email, which Stripe requires to complete", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID, email: "ben@example.org" } } });
    happyPathDb();
    mockSessionsCreate.mockResolvedValue({ id: "cs_1", client_secret: "cs_secret" });

    await POST(makeReq(ONE_TICKET), params);
    expect(mockSessionsCreate.mock.calls[0][0].customer_email).toBe("ben@example.org");
  });

  it("omits customer_email rather than sending null when the account has no email", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    happyPathDb();
    mockSessionsCreate.mockResolvedValue({ id: "cs_1", client_secret: "cs_secret" });

    await POST(makeReq(ONE_TICKET), params);
    expect(mockSessionsCreate.mock.calls[0][0]).not.toHaveProperty("customer_email");
  });

  it("keeps the session payable window inside Stripe's 30-minute floor and under the db hold", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    happyPathDb();
    mockSessionsCreate.mockResolvedValue({ id: "cs_1", client_secret: "cs_secret" });

    const before = Math.floor(Date.now() / 1000);
    await POST(makeReq(ONE_TICKET), params);
    const arg = mockSessionsCreate.mock.calls[0][0];
    const windowSecs = arg.expires_at - before;

    // Stripe rejects anything under 30 minutes out.
    expect(windowSecs).toBeGreaterThanOrEqual(30 * 60);
    // And the session must die before the db hold releases the stock, or a late
    // payment lands on an order the sweeper already expired.
    expect(windowSecs).toBeLessThan(35 * 60);

    // The hold passed to the RPC is the longer of the two.
    expect(mockRpc).toHaveBeenCalledWith(
      "reserve_ticket_order",
      expect.objectContaining({ hold_minutes: 35 })
    );
  });

  it("stores the session id on the order so webhook redelivery is idempotent", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    happyPathDb();
    mockSessionsCreate.mockResolvedValue({ id: "cs_abc", client_secret: "cs_secret" });

    await POST(makeReq(ONE_TICKET), params);
    const updateChain = mockAdminFrom.mock.results[3].value;
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ stripe_checkout_session_id: "cs_abc" })
    );
  });

  it("releases the hold when Stripe rejects the session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    happyPathDb();
    mockSessionsCreate.mockRejectedValue(new Error("stripe down"));

    const res = await POST(makeReq(ONE_TICKET), params);
    expect(res.status).toBe(502);
    const updateChain = mockAdminFrom.mock.results[3].value;
    expect(updateChain.update).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  });
});
