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

// Returns a chainable Supabase query builder mock that resolves at the terminal methods.
function chain(result: any) {
  const c: any = {};
  for (const m of ["select", "eq", "insert", "is"]) c[m] = vi.fn().mockReturnValue(c);
  c.maybeSingle = vi.fn().mockResolvedValue(result);
  c.single = vi.fn().mockResolvedValue(result);
  return c;
}

function req(setId: string, body: object) {
  return new Request(`http://localhost/api/sets/${setId}/invite/link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const OWNER_ID = "owner-1";
const setRow = { id: "set-1", name: "My Set", owner_user_id: OWNER_ID };
const insertedInvite = { id: "invite-1", token: "tok-abc" };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: OWNER_ID } } });
});

describe("POST /api/sets/[id]/invite/link", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(req("set-1", {}), { params: Promise.resolve({ id: "set-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when set does not exist", async () => {
    mockAdminFrom.mockReturnValueOnce(chain({ data: null }));
    const res = await POST(req("set-1", {}), { params: Promise.resolve({ id: "set-1" }) });
    expect(res.status).toBe(404);
  });

  it("returns 403 when caller is a viewer-role collaborator, not an editor", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "viewer-1" } } });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: setRow })) // sets
      .mockReturnValueOnce(chain({ data: null }));  // editor-role check finds no row
    const res = await POST(req("set-1", { role: "editor" }), { params: Promise.resolve({ id: "set-1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 403 when caller has no relationship to the set", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "stranger-1" } } });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: setRow }))
      .mockReturnValueOnce(chain({ data: null }));
    const res = await POST(req("set-1", {}), { params: Promise.resolve({ id: "set-1" }) });
    expect(res.status).toBe(403);
  });

  it("lets the owner mint a viewer-role link", async () => {
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: setRow }))
      .mockReturnValueOnce(chain({ data: insertedInvite }));
    const res = await POST(req("set-1", { role: "viewer" }), { params: Promise.resolve({ id: "set-1" }) });
    expect(res.status).toBe(200);
    const insertChain = mockAdminFrom.mock.results[1].value;
    expect(insertChain.insert).toHaveBeenCalledWith(expect.objectContaining({ role: "viewer" }));
  });

  it("lets a non-owner editor collaborator mint a viewer-role link", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "editor-1" } } });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: setRow }))                  // sets
      .mockReturnValueOnce(chain({ data: { id: "editor-collab" } })) // editor-role check
      .mockReturnValueOnce(chain({ data: insertedInvite }));         // insert
    const res = await POST(req("set-1", { role: "viewer" }), { params: Promise.resolve({ id: "set-1" }) });
    expect(res.status).toBe(200);
    const insertChain = mockAdminFrom.mock.results[2].value;
    expect(insertChain.insert).toHaveBeenCalledWith(expect.objectContaining({ role: "viewer" }));
  });

  it("defaults to editor when no role is provided", async () => {
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: setRow }))
      .mockReturnValueOnce(chain({ data: insertedInvite }));
    const res = await POST(req("set-1", {}), { params: Promise.resolve({ id: "set-1" }) });
    expect(res.status).toBe(200);
    const insertChain = mockAdminFrom.mock.results[1].value;
    expect(insertChain.insert).toHaveBeenCalledWith(expect.objectContaining({ role: "editor" }));
  });
});
