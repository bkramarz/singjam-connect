import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockAdminFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockAdminFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: vi.fn(() => ({ from: mockAdminFrom })),
}));

import { POST } from "./route";

function chain(result: any) {
  const c: any = {};
  for (const m of ["select", "eq", "update", "is"]) c[m] = vi.fn().mockReturnValue(c);
  c.maybeSingle = vi.fn().mockResolvedValue(result);
  c.then = (resolve: any) => Promise.resolve(result).then(resolve);
  return c;
}

function makeReq(body: object) {
  return new Request("http://localhost/api/invite/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const JAM_ID = "jam-1";
const TOKEN = "token-abc";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/invite/claim", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeReq({ token: TOKEN }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when token is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("claims the invite for a regular invitee", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "invitee-1" } } });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { jam_id: JAM_ID } })) // select jam_id
      .mockReturnValueOnce(chain({ data: { host_user_id: "host-1" } })) // jams host lookup
      .mockReturnValueOnce(chain({ data: null })); // update

    const res = await POST(makeReq({ token: TOKEN }));
    expect(res.status).toBe(200);
    const updateChain = mockAdminFrom.mock.results[2].value;
    expect(updateChain.update).toHaveBeenCalledWith({ invited_user_id: "invitee-1" });
  });

  it("does not claim the invite when the caller is the jam's host", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "host-1" } } });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { jam_id: JAM_ID } })) // select jam_id
      .mockReturnValueOnce(chain({ data: { host_user_id: "host-1" } })); // jams host lookup

    const res = await POST(makeReq({ token: TOKEN }));
    expect(res.status).toBe(200);
    // Only 2 admin calls (jam_invites select + jams select) — no update call
    expect(mockAdminFrom).toHaveBeenCalledTimes(2);
  });

  it("returns ok with a null jamId when the token doesn't match an invite", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockAdminFrom.mockReturnValueOnce(chain({ data: null }));

    const res = await POST(makeReq({ token: TOKEN }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, jamId: null });
    expect(mockAdminFrom).toHaveBeenCalledTimes(1);
  });
});
