import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockAdminFrom, mockCreateNotification } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockAdminFrom: vi.fn(),
  mockCreateNotification: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: vi.fn(() => ({ from: mockAdminFrom })),
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: mockCreateNotification,
}));

import { POST } from "./route";

function chain(result: any) {
  const c: any = {};
  for (const m of ["select", "eq", "update", "insert"]) c[m] = vi.fn().mockReturnValue(c);
  c.single = vi.fn().mockResolvedValue(result);
  c.maybeSingle = vi.fn().mockResolvedValue(result);
  c.then = (resolve: any) => Promise.resolve(result).then(resolve);
  return c;
}

function makeReq(body: object) {
  return new Request("http://localhost/api/jam/jam-1/invite/respond", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const JAM_ID = "jam-1";
const HOST_ID = "host-1";
const INVITE_ROW = { id: "invite-1", status: "pending", invited_by: "someone-else" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/jam/[id]/invite/respond", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeReq({ response: "accepted" }), { params: Promise.resolve({ id: JAM_ID }) });
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid response value", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const res = await POST(makeReq({ response: "maybe" }), { params: Promise.resolve({ id: JAM_ID }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when there is no matching invite", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockAdminFrom.mockReturnValueOnce(chain({ data: null }));
    const res = await POST(makeReq({ response: "accepted" }), { params: Promise.resolve({ id: JAM_ID }) });
    expect(res.status).toBe(404);
  });

  it("rejects acceptance when the caller is the jam's own host, even if a stray invite row points at them", async () => {
    // Guards the case where /api/invite/claim (or bad data) left invited_user_id = the host.
    mockGetUser.mockResolvedValue({ data: { user: { id: HOST_ID } } });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: INVITE_ROW })) // jam_invites select
      .mockReturnValueOnce(chain({ error: null })) // jam_invites status update
      .mockReturnValueOnce(chain({ data: { capacity: null, name: "Test Jam", host_user_id: HOST_ID } })); // jams select

    const res = await POST(makeReq({ response: "accepted" }), { params: Promise.resolve({ id: JAM_ID }) });
    expect(res.status).toBe(400);
    // Only 3 admin calls — no jam_rsvps insert/update ever attempted
    expect(mockAdminFrom).toHaveBeenCalledTimes(3);
  });

  it("auto-RSVPs a regular invitee who accepts", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "invitee-1" } } });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: INVITE_ROW })) // jam_invites select
      .mockReturnValueOnce(chain({ error: null })) // jam_invites status update
      .mockReturnValueOnce(chain({ data: { capacity: null, name: "Test Jam", host_user_id: HOST_ID } })) // jams select
      .mockReturnValueOnce(chain({ count: 0 })) // attending count
      .mockReturnValueOnce(chain({ data: null })) // existing rsvp lookup
      .mockReturnValueOnce(chain({ error: null })) // rsvp insert
      .mockReturnValueOnce(chain({ data: null })) // linked set lookup
      .mockReturnValueOnce(chain({ data: { display_name: "Invitee" } })); // profile lookup

    const res = await POST(makeReq({ response: "accepted" }), { params: Promise.resolve({ id: JAM_ID }) });
    expect(res.status).toBe(200);
    const rsvpInsertChain = mockAdminFrom.mock.results[5].value;
    expect(rsvpInsertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ jam_id: JAM_ID, user_id: "invitee-1", status: "attending" })
    );
  });
});
