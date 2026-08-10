import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockAdminFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockAdminFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
}));
vi.mock("@/lib/supabase/bearer", () => ({
  supabaseFromBearer: vi.fn(() => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: vi.fn(() => ({ from: mockAdminFrom })),
}));

import { POST, DELETE } from "./route";

function chain(result: any) {
  const c: any = {};
  for (const m of ["select", "eq", "update", "is"]) c[m] = vi.fn().mockReturnValue(c);
  c.maybeSingle = vi.fn().mockResolvedValue(result);
  c.single = vi.fn().mockResolvedValue(result);
  c.then = (resolve: any) => Promise.resolve(result).then(resolve);
  return c;
}

const JAM_ID = "jam-1";
const HOST = "host-1";
const COHOST = "cohost-1";
const TICKET = "ticket-1";
const params = { params: Promise.resolve({ id: JAM_ID }) };

const postReq = (body: any = { ticket_id: TICKET }) =>
  new Request(`http://localhost/api/jam/${JAM_ID}/tickets/checkin`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const delReq = (ticketId = TICKET) =>
  new Request(`http://localhost/api/jam/${JAM_ID}/tickets/checkin?ticket_id=${ticketId}`, {
    method: "DELETE",
  });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/jam/[id]/tickets/checkin", () => {
  it("rejects an unauthenticated caller", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(postReq(), params);
    expect(res.status).toBe(401);
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it("refuses a stranger", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "rando" } } });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { host_user_id: HOST } }))
      .mockReturnValueOnce(chain({ data: null }));

    const res = await POST(postReq(), params);
    expect(res.status).toBe(403);
  });

  it("allows a co-host to work the door", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: COHOST } } });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { host_user_id: HOST } }))
      .mockReturnValueOnce(chain({ data: { id: "ch1" } })) // co-host row
      .mockReturnValueOnce(chain({ data: { id: TICKET, checked_in_at: null } }))
      .mockReturnValueOnce(chain({ error: null }));

    const res = await POST(postReq(), params);
    expect(res.status).toBe(200);
    expect((await res.json()).already_checked_in).toBe(false);
  });

  it("checks a guest in and stamps who did it", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: HOST } } });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { host_user_id: HOST } }))
      .mockReturnValueOnce(chain({ data: { id: TICKET, checked_in_at: null } }))
      .mockReturnValueOnce(chain({ error: null }));

    const res = await POST(postReq(), params);
    expect(res.status).toBe(200);
    const update = mockAdminFrom.mock.results[2].value;
    expect(update.update).toHaveBeenCalledWith(
      expect.objectContaining({ checked_in_by: HOST })
    );
    // First tap wins if two people scan at once.
    expect(update.is).toHaveBeenCalledWith("checked_in_at", null);
  });

  it("reports a duplicate scan without overwriting the arrival time", async () => {
    const original = "2026-08-07T19:00:00Z";
    mockGetUser.mockResolvedValue({ data: { user: { id: HOST } } });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { host_user_id: HOST } }))
      .mockReturnValueOnce(chain({ data: { id: TICKET, checked_in_at: original } }));

    const res = await POST(postReq(), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ already_checked_in: true, checked_in_at: original });
    // No update ran — the original time survives.
    expect(mockAdminFrom).toHaveBeenCalledTimes(2);
  });

  it("404s a ticket belonging to a different event", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: HOST } } });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { host_user_id: HOST } }))
      .mockReturnValueOnce(chain({ data: null })); // scoped by jam_id, so no match

    const res = await POST(postReq(), params);
    expect(res.status).toBe(404);
  });

  it("requires a ticket_id", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: HOST } } });
    mockAdminFrom.mockReturnValueOnce(chain({ data: { host_user_id: HOST } }));
    const res = await POST(postReq({}), params);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/jam/[id]/tickets/checkin", () => {
  it("undoes a mistaken check-in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: HOST } } });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { host_user_id: HOST } }))
      .mockReturnValueOnce(chain({ error: null }));

    const res = await DELETE(delReq(), params);
    expect(res.status).toBe(200);
    expect(mockAdminFrom.mock.results[1].value.update).toHaveBeenCalledWith({
      checked_in_at: null,
      checked_in_by: null,
    });
  });

  it("refuses a stranger", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "rando" } } });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { host_user_id: HOST } }))
      .mockReturnValueOnce(chain({ data: null }));

    const res = await DELETE(delReq(), params);
    expect(res.status).toBe(403);
  });
});
