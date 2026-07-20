import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetUser,
  mockBearerGetUser,
  mockAdminFrom,
  mockGetUserById,
  mockCreateNotification,
  mockSend,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockBearerGetUser: vi.fn(),
  mockAdminFrom: vi.fn(),
  mockGetUserById: vi.fn(),
  mockCreateNotification: vi.fn(),
  mockSend: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
}));

vi.mock("@/lib/supabase/bearer", () => ({
  supabaseFromBearer: vi.fn(() => ({ auth: { getUser: mockBearerGetUser } })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: vi.fn(() => ({
    from: mockAdminFrom,
    auth: { admin: { getUserById: mockGetUserById } },
  })),
}));

vi.mock("@/lib/resend", () => ({
  resend: { emails: { send: mockSend } },
  FROM_ADDRESS: "test@singjam.org",
}));

vi.mock("@/emails/jam-waitlist-promoted", () => ({ jamWaitlistPromotedHtml: vi.fn(() => "<html>") }));
vi.mock("@/emails/jam-rsvp-confirmed", () => ({ jamRsvpConfirmedHtml: vi.fn(() => "<html>") }));

vi.mock("@/lib/notifications", () => ({ createNotification: mockCreateNotification }));

import { POST, DELETE } from "./route";

function chain(result: any) {
  const c: any = {};
  for (const m of ["select", "eq", "in", "update", "insert", "delete", "order", "limit"]) {
    c[m] = vi.fn().mockReturnValue(c);
  }
  c.single = vi.fn().mockResolvedValue(result);
  c.maybeSingle = vi.fn().mockResolvedValue(result);
  c.then = (resolve: any) => Promise.resolve(result).then(resolve);
  return c;
}

function makeReq(method: "POST" | "DELETE", headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/jam/jam-1/rsvp", { method, headers });
}

const JAM_ID = "jam-1";
const USER_ID = "user-1";
const HOST_ID = "host-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/jam/[id]/rsvp", () => {
  it("returns 401 when neither cookie session nor bearer token authenticates", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeReq("POST"), { params: Promise.resolve({ id: JAM_ID }) });
    expect(res.status).toBe(401);
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it("authenticates via bearer token when there is no cookie session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockBearerGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { capacity: null, host_user_id: USER_ID, name: "X", visibility: "community" } })) // jams
      .mockReturnValueOnce(chain({ count: 0 })) // attending count
      .mockReturnValueOnce(chain({ data: { id: "r1", status: "attending" } })) // existing rsvp
      .mockReturnValueOnce(chain({ error: null })) // rsvp update
      .mockReturnValueOnce(chain({ data: null })); // linked set

    const res = await POST(makeReq("POST", { Authorization: "Bearer tok" }), { params: Promise.resolve({ id: JAM_ID }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "attending", waitlist_position: null });
  });

  it("waitlists (with position) when the jam is at capacity", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { capacity: 1, host_user_id: HOST_ID, name: "X", visibility: "community" } })) // jams
      .mockReturnValueOnce(chain({ count: 1 })) // attending count → full
      .mockReturnValueOnce(chain({ data: null })) // existing rsvp
      .mockReturnValueOnce(chain({ count: 2 })) // waitlist count → position 3
      .mockReturnValueOnce(chain({ error: null })) // rsvp insert
      .mockReturnValueOnce(chain({ data: { display_name: "Me" } })); // host-notify profile lookup

    const res = await POST(makeReq("POST"), { params: Promise.resolve({ id: JAM_ID }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "waitlist", waitlist_position: 3 });
    const insertChain = mockAdminFrom.mock.results[4].value;
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: "waitlist", waitlist_position: 3, user_id: USER_ID })
    );
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: HOST_ID, type: "jam_rsvp" })
    );
  });

  it("rejects RSVPs to official (external-ticketing) events", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockAdminFrom.mockReturnValueOnce(chain({ data: { capacity: null, host_user_id: HOST_ID, name: "X", visibility: "official" } }));
    const res = await POST(makeReq("POST"), { params: Promise.resolve({ id: JAM_ID }) });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/jam/[id]/rsvp", () => {
  it("promotes the first waitlisted attendee when a confirmed spot opens up", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockGetUserById.mockResolvedValue({ data: { user: { email: "next@example.com" } } });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { id: "r1", status: "attending" } })) // caller's rsvp
      .mockReturnValueOnce(chain({ error: null })) // cancel update
      .mockReturnValueOnce(chain({ error: null })) // cohosts delete
      .mockReturnValueOnce(chain({ data: { id: "r2", user_id: "u2" } })) // next waitlist person
      .mockReturnValueOnce(chain({ error: null })) // promote update
      .mockReturnValueOnce(chain({ data: { display_name: "Them" } })) // profile
      .mockReturnValueOnce(chain({ data: { name: "X" } })); // jam name for email

    const res = await DELETE(makeReq("DELETE"), { params: Promise.resolve({ id: JAM_ID }) });
    expect(res.status).toBe(200);
    const promoteChain = mockAdminFrom.mock.results[4].value;
    expect(promoteChain.update).toHaveBeenCalledWith({ status: "attending", waitlist_position: null });
  });

  it("returns 404 when the caller has no RSVP to cancel", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockAdminFrom.mockReturnValueOnce(chain({ data: null }));
    const res = await DELETE(makeReq("DELETE"), { params: Promise.resolve({ id: JAM_ID }) });
    expect(res.status).toBe(404);
  });
});
