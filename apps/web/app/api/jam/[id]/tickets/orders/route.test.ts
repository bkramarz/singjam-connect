import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockAdminFrom, mockFetchAllRows } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockAdminFrom: vi.fn(),
  mockFetchAllRows: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
}));
vi.mock("@/lib/supabase/bearer", () => ({
  supabaseFromBearer: vi.fn(() => ({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: vi.fn(() => ({ from: mockAdminFrom })),
}));
vi.mock("@singjam/core", () => ({ fetchAllRows: mockFetchAllRows }));

import { GET } from "./route";

function chain(result: any) {
  const c: any = {};
  for (const m of ["select", "eq", "in", "order", "range"]) c[m] = vi.fn().mockReturnValue(c);
  c.single = vi.fn().mockResolvedValue(result);
  c.maybeSingle = vi.fn().mockResolvedValue(result);
  c.then = (resolve: any) => Promise.resolve(result).then(resolve);
  return c;
}

const JAM_ID = "jam-1";
const HOST = "host-1";
const COHOST = "cohost-1";
const params = { params: Promise.resolve({ id: JAM_ID }) };
const req = () => new Request(`http://localhost/api/jam/${JAM_ID}/tickets/orders`);

function ticket(over: any = {}) {
  return {
    id: over.id ?? "t1",
    qr_token: over.qr_token ?? "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    holder_name: null,
    holder_email: null,
    checked_in_at: null,
    ticket_types: { name: "General" },
    ticket_orders: {
      id: over.order_id ?? "o1",
      status: "paid",
      buyer_name: "Jo Guest",
      buyer_email: "guest@example.com",
      buyer_user_id: null,
      amount_cents: 3000,
      currency: "usd",
      paid_at: "2026-08-07T00:00:00Z",
      ...(over.order ?? {}),
    },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchAllRows.mockResolvedValue([]);
});

describe("GET /api/jam/[id]/tickets/orders", () => {
  it("rejects an unauthenticated caller", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(req(), params);
    expect(res.status).toBe(401);
    expect(mockFetchAllRows).not.toHaveBeenCalled();
  });

  it("refuses a stranger — buyer emails must not leak", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "rando" } } });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { host_user_id: HOST } }))
      .mockReturnValueOnce(chain({ data: null })); // not a co-host

    const res = await GET(req(), params);
    expect(res.status).toBe(403);
    expect(mockFetchAllRows).not.toHaveBeenCalled();
  });

  it("allows a co-host", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: COHOST } } });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { host_user_id: HOST } }))
      .mockReturnValueOnce(chain({ data: { id: "ch1" } }));

    const res = await GET(req(), params);
    expect(res.status).toBe(200);
  });

  it("counts a multi-ticket order's revenue once, not once per ticket", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: HOST } } });
    mockAdminFrom.mockReturnValueOnce(chain({ data: { host_user_id: HOST } }));
    // One $30 order containing two tickets.
    mockFetchAllRows.mockResolvedValue([
      ticket({ id: "t1", order_id: "o1" }),
      ticket({ id: "t2", order_id: "o1" }),
    ]);

    const json = await (await GET(req(), params)).json();
    expect(json.summary.tickets_sold).toBe(2);
    expect(json.summary.orders).toBe(1);
    // The bug this guards: summing per ticket would report 6000.
    expect(json.summary.gross_cents).toBe(3000);
  });

  it("labels guests and resolves member names from their profile", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: HOST } } });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { host_user_id: HOST } })) // jam
      .mockReturnValueOnce(chain({ data: [{ id: "u1", display_name: "Ben K", username: "ben" }] })); // profiles

    mockFetchAllRows.mockResolvedValue([
      ticket({ id: "t1", order_id: "o1" }),
      ticket({
        id: "t2",
        order_id: "o2",
        order: { id: "o2", buyer_user_id: "u1", buyer_name: null, buyer_email: null },
      }),
    ]);

    const json = await (await GET(req(), params)).json();
    const byId = Object.fromEntries(json.guests.map((g: any) => [g.ticket_id, g]));
    expect(byId.t1).toMatchObject({ name: "Jo Guest", is_member: false });
    expect(byId.t2).toMatchObject({ name: "Ben K", is_member: true });
  });

  it("exposes a short door code derived from the ticket token", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: HOST } } });
    mockAdminFrom.mockReturnValueOnce(chain({ data: { host_user_id: HOST } }));
    mockFetchAllRows.mockResolvedValue([ticket()]);

    const json = await (await GET(req(), params)).json();
    expect(json.guests[0].code).toBe("AAAAAA");
  });

  it("fetches the whole guest list rather than one capped page", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: HOST } } });
    mockAdminFrom.mockReturnValueOnce(chain({ data: { host_user_id: HOST } }));
    await GET(req(), params);
    // A door list that silently truncates would leave paying attendees off it.
    expect(mockFetchAllRows).toHaveBeenCalledTimes(1);
  });
});
