import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockBearerGetUser, mockAdminFrom, mockRpc, mockServerFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockBearerGetUser: vi.fn(),
  mockAdminFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockServerFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser }, from: mockServerFrom }),
}));
vi.mock("@/lib/supabase/bearer", () => ({
  supabaseFromBearer: vi.fn(() => ({ auth: { getUser: mockBearerGetUser } })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: vi.fn(() => ({ from: mockAdminFrom, rpc: mockRpc })),
}));

import { GET, POST, PATCH, DELETE } from "./route";

function chain(result: any) {
  const c: any = {};
  for (const m of ["select", "eq", "insert", "update", "delete", "order"]) {
    c[m] = vi.fn().mockReturnValue(c);
  }
  c.single = vi.fn().mockResolvedValue(result);
  c.maybeSingle = vi.fn().mockResolvedValue(result);
  c.then = (resolve: any) => Promise.resolve(result).then(resolve);
  return c;
}

const JAM_ID = "jam-1";
const HOST = "host-1";
const COHOST = "cohost-1";
const STRANGER = "rando-1";
const TYPE_ID = "type-1";

const params = { params: Promise.resolve({ id: JAM_ID }) };

function req(method: string, body?: any, url = `http://localhost/api/jam/${JAM_ID}/tickets/types`) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/jam/[id]/tickets/types", () => {
  it("404s when the jam is not visible to the caller", async () => {
    // The jams RLS policy decides visibility; an invisible jam reads as null.
    mockServerFrom.mockReturnValueOnce(chain({ data: null }));
    const res = await GET(req("GET"), params);
    expect(res.status).toBe(404);
  });

  it("returns tiers with derived availability", async () => {
    mockServerFrom.mockReturnValueOnce(chain({ data: { id: JAM_ID } }));
    mockAdminFrom.mockReturnValueOnce(
      chain({
        data: [
          { id: TYPE_ID, name: "General", price_cents: 1500, currency: "usd", quantity: 10,
            sales_start_at: null, sales_end_at: null, sort_order: 0, description: null },
        ],
      })
    );
    // First call is sold_count (counts live holds), second is paid_count.
    mockRpc.mockImplementation((fn: string) =>
      Promise.resolve({ data: fn === "ticket_type_paid_count" ? 3 : 4 })
    );

    const res = await GET(req("GET"), params);
    const json = await res.json();
    expect(res.status).toBe(200);
    // 4 against stock, 3 of them paid → 1 merely held, 6 left.
    expect(json.ticket_types[0]).toMatchObject({ sold: 3, held: 1, remaining: 6, on_sale: true });
  });

  it("marks a tier sold out rather than reporting negative stock", async () => {
    mockServerFrom.mockReturnValueOnce(chain({ data: { id: JAM_ID } }));
    mockAdminFrom.mockReturnValueOnce(
      chain({
        data: [
          { id: TYPE_ID, name: "General", price_cents: 1500, currency: "usd", quantity: 5,
            sales_start_at: null, sales_end_at: null, sort_order: 0, description: null },
        ],
      })
    );
    mockRpc.mockResolvedValue({ data: 5 });

    const json = await (await GET(req("GET"), params)).json();
    expect(json.ticket_types[0]).toMatchObject({ remaining: 0, on_sale: false });
  });

  it("closes sales once the window has passed", async () => {
    mockServerFrom.mockReturnValueOnce(chain({ data: { id: JAM_ID } }));
    mockAdminFrom.mockReturnValueOnce(
      chain({
        data: [
          { id: TYPE_ID, name: "Early bird", price_cents: 1000, currency: "usd", quantity: null,
            sales_start_at: null, sales_end_at: new Date(Date.now() - 1000).toISOString(),
            sort_order: 0, description: null },
        ],
      })
    );
    mockRpc.mockResolvedValue({ data: 0 });

    const json = await (await GET(req("GET"), params)).json();
    expect(json.ticket_types[0]).toMatchObject({ closed: true, on_sale: false });
  });
});

describe("POST /api/jam/[id]/tickets/types", () => {
  it("rejects an unauthenticated caller", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(req("POST", { name: "General", price_cents: 1500 }), params);
    expect(res.status).toBe(401);
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it("refuses a signed-in stranger", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: STRANGER } } });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { host_user_id: HOST } })) // jam
      .mockReturnValueOnce(chain({ data: null })); // no cohost row

    const res = await POST(req("POST", { name: "General", price_cents: 1500 }), params);
    expect(res.status).toBe(403);
  });

  it("allows a co-host, not just the host", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: COHOST } } });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { host_user_id: HOST } }))
      .mockReturnValueOnce(chain({ data: { id: "ch-1" } })) // cohost row exists
      .mockReturnValueOnce(chain({ data: { id: TYPE_ID } })); // insert

    const res = await POST(req("POST", { name: "General", price_cents: 1500 }), params);
    expect(res.status).toBe(200);
  });

  it("rejects a non-integer price", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: HOST } } });
    mockAdminFrom.mockReturnValueOnce(chain({ data: { host_user_id: HOST } }));
    const res = await POST(req("POST", { name: "General", price_cents: 15.5 }), params);
    expect(res.status).toBe(400);
  });

  it("rejects a negative price", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: HOST } } });
    mockAdminFrom.mockReturnValueOnce(chain({ data: { host_user_id: HOST } }));
    const res = await POST(req("POST", { name: "General", price_cents: -100 }), params);
    expect(res.status).toBe(400);
  });

  it("rejects a blank name", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: HOST } } });
    mockAdminFrom.mockReturnValueOnce(chain({ data: { host_user_id: HOST } }));
    const res = await POST(req("POST", { name: "   ", price_cents: 1500 }), params);
    expect(res.status).toBe(400);
  });

  it("accepts a free tier at zero cents", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: HOST } } });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { host_user_id: HOST } }))
      .mockReturnValueOnce(chain({ data: { id: TYPE_ID } }));
    const res = await POST(req("POST", { name: "Free", price_cents: 0 }), params);
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/jam/[id]/tickets/types", () => {
  it("refuses to cut capacity below tickets already sold", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: HOST } } });
    mockAdminFrom.mockReturnValueOnce(chain({ data: { host_user_id: HOST } }));
    mockRpc.mockResolvedValue({ data: 8 });

    const res = await PATCH(req("PATCH", { id: TYPE_ID, quantity: 5 }), params);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("8 already sold");
  });

  it("allows raising capacity", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: HOST } } });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { host_user_id: HOST } }))
      .mockReturnValueOnce(chain({ error: null }));
    mockRpc.mockResolvedValue({ data: 8 });

    const res = await PATCH(req("PATCH", { id: TYPE_ID, quantity: 20 }), params);
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/jam/[id]/tickets/types", () => {
  it("refuses to delete a tier that has sold tickets", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: HOST } } });
    mockAdminFrom.mockReturnValueOnce(chain({ data: { host_user_id: HOST } }));
    mockRpc.mockResolvedValue({ data: 3 });

    const res = await DELETE(
      req("DELETE", undefined, `http://localhost/api/jam/${JAM_ID}/tickets/types?type_id=${TYPE_ID}`),
      params
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("3 ticket(s) sold");
  });

  it("deletes an unsold tier", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: HOST } } });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { host_user_id: HOST } }))
      .mockReturnValueOnce(chain({ error: null }));
    mockRpc.mockResolvedValue({ data: 0 });

    const res = await DELETE(
      req("DELETE", undefined, `http://localhost/api/jam/${JAM_ID}/tickets/types?type_id=${TYPE_ID}`),
      params
    );
    expect(res.status).toBe(200);
  });
  it("reports a hold as held, not sold — an abandoned checkout is not revenue", async () => {
    mockServerFrom.mockReturnValueOnce(chain({ data: { id: JAM_ID } }));
    mockAdminFrom.mockReturnValueOnce(
      chain({
        data: [
          { id: TYPE_ID, name: "General", price_cents: 1500, currency: "usd", quantity: 20,
            sales_start_at: null, sales_end_at: null, sort_order: 0, description: null },
        ],
      })
    );
    // 4 tickets holding stock, none paid for.
    mockRpc.mockImplementation((fn: string) =>
      Promise.resolve({ data: fn === "ticket_type_paid_count" ? 0 : 4 })
    );

    const json = await (await GET(req("GET"), params)).json();
    const tier = json.ticket_types[0];
    expect(tier.sold).toBe(0);
    expect(tier.held).toBe(4);
    // Availability still subtracts the holds, or two buyers could take one seat.
    expect(tier.remaining).toBe(16);
  });
});
