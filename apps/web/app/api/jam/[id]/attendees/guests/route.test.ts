import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAdminFrom, mockFetchAllRows } = vi.hoisted(() => ({
  mockAdminFrom: vi.fn(),
  mockFetchAllRows: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: vi.fn(() => ({ from: mockAdminFrom })),
}));
vi.mock("@singjam/core", () => ({ fetchAllRows: mockFetchAllRows }));

import { GET } from "./route";

function chain(result: any) {
  const c: any = {};
  for (const m of ["select", "eq", "is", "order", "range"]) c[m] = vi.fn().mockReturnValue(c);
  c.maybeSingle = vi.fn().mockResolvedValue(result);
  c.then = (resolve: any) => Promise.resolve(result).then(resolve);
  return c;
}

const JAM = "jam-1";
const params = Promise.resolve({ id: JAM });
const req = new Request("http://localhost/api/jam/jam-1/attendees/guests");

beforeEach(() => {
  vi.clearAllMocks();
  mockAdminFrom.mockReturnValue(chain({ data: { id: JAM } })); // jam exists
});

describe("GET /api/jam/[id]/attendees/guests", () => {
  it("lists a guest by the name they bought under", async () => {
    mockFetchAllRows.mockResolvedValue([
      { order_id: "o1", holder_name: "Ada Lovelace", ticket_orders: { status: "paid", buyer_name: "Ada Lovelace" } },
    ]);
    const res = await GET(req, { params });
    expect(await res.json()).toEqual({ guests: [{ name: "Ada Lovelace", extra: 0 }] });
  });

  it("collapses a multi-ticket order into one row with a count", async () => {
    // One name was given for four tickets; four identical rows reads as a bug.
    mockFetchAllRows.mockResolvedValue([
      { order_id: "o1", holder_name: "Ada", ticket_orders: { status: "paid", buyer_name: "Ada" } },
      { order_id: "o1", holder_name: "Ada", ticket_orders: { status: "paid", buyer_name: "Ada" } },
      { order_id: "o1", holder_name: "Ada", ticket_orders: { status: "paid", buyer_name: "Ada" } },
      { order_id: "o1", holder_name: "Ada", ticket_orders: { status: "paid", buyer_name: "Ada" } },
    ]);
    const res = await GET(req, { params });
    expect(await res.json()).toEqual({ guests: [{ name: "Ada", extra: 3 }] });
  });

  it("keeps separate orders separate", async () => {
    mockFetchAllRows.mockResolvedValue([
      { order_id: "o1", holder_name: "Ada", ticket_orders: { status: "paid", buyer_name: "Ada" } },
      { order_id: "o2", holder_name: "Grace", ticket_orders: { status: "paid", buyer_name: "Grace" } },
    ]);
    const res = await GET(req, { params });
    expect(await res.json()).toEqual({
      guests: [{ name: "Ada", extra: 0 }, { name: "Grace", extra: 0 }],
    });
  });

  it("falls back to the buyer name, then to 'Guest'", async () => {
    mockFetchAllRows.mockResolvedValue([
      { order_id: "o1", holder_name: null, ticket_orders: { status: "paid", buyer_name: "Grace" } },
      { order_id: "o2", holder_name: null, ticket_orders: { status: "paid", buyer_name: null } },
    ]);
    const res = await GET(req, { params });
    expect(await res.json()).toEqual({
      guests: [{ name: "Grace", extra: 0 }, { name: "Guest", extra: 0 }],
    });
  });

  it("asks only for unclaimed tickets on paid orders", async () => {
    mockFetchAllRows.mockResolvedValue([]);
    await GET(req, { params });
    // Run the builder the route handed to fetchAllRows and inspect the filters.
    const build = mockFetchAllRows.mock.calls[0][0];
    const c = chain({ data: [] });
    mockAdminFrom.mockReturnValue(c);
    build(0, 999);
    expect(c.is).toHaveBeenCalledWith("holder_user_id", null);
    expect(c.eq).toHaveBeenCalledWith("ticket_orders.status", "paid");
    expect(c.order).toHaveBeenCalledWith("id", { ascending: true });
  });

  it("never exposes an email or a door code", async () => {
    mockFetchAllRows.mockResolvedValue([
      { order_id: "o1", holder_name: "Ada", ticket_orders: { status: "paid", buyer_name: "Ada" } },
    ]);
    await GET(req, { params });
    const build = mockFetchAllRows.mock.calls[0][0];
    const c = chain({ data: [] });
    mockAdminFrom.mockReturnValue(c);
    build(0, 999);
    const selected = c.select.mock.calls[0][0];
    expect(selected).not.toMatch(/email/);
    expect(selected).not.toMatch(/qr_token/);
  });

  it("404s for a jam that doesn't exist", async () => {
    mockAdminFrom.mockReturnValue(chain({ data: null }));
    const res = await GET(req, { params });
    expect(res.status).toBe(404);
  });
});
