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
  supabaseAdmin: vi.fn(() => ({
    from: mockAdminFrom,
    auth: { admin: { getUserById: vi.fn() } },
  })),
}));

vi.mock("@/lib/resend", () => ({
  resend: { emails: { send: vi.fn() } },
  FROM_ADDRESS: "hello@singjam.org",
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(),
}));

vi.mock("@/emails/set-access-granted", () => ({
  setAccessGrantedHtml: vi.fn().mockReturnValue("<p>granted</p>"),
}));

import { PATCH } from "./route";

// Chainable mock for select().eq()...maybeSingle().
function chain(result: any) {
  const c: any = {};
  for (const m of ["select", "eq", "in"]) c[m] = vi.fn().mockReturnValue(c);
  c.maybeSingle = vi.fn().mockResolvedValue(result);
  c.single = vi.fn().mockResolvedValue(result);
  return c;
}

// Chainable mock for update().eq().eq() awaited directly (no terminal method).
function updateChain(result: any) {
  const c: any = {};
  c.update = vi.fn().mockReturnValue(c);
  c.eq = vi.fn().mockReturnValue(c);
  c.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
  return c;
}

function req(setId: string, body: object) {
  return new Request(`http://localhost/api/sets/${setId}/collaborators`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const OWNER_ID = "owner-1";
const acceptedEditor = { user_id: "user-2", status: "accepted", role: "editor" };
const acceptedCoOwner = { user_id: "user-3", status: "accepted", role: "co-owner" };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: OWNER_ID } } });
});

describe("PATCH /api/sets/[id]/collaborators", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await PATCH(req("set-1", { collaboratorId: "c-1", role: "editor" }), {
      params: Promise.resolve({ id: "set-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects an invalid role value", async () => {
    const res = await PATCH(req("set-1", { collaboratorId: "c-1", role: "boss" }), {
      params: Promise.resolve({ id: "set-1" }),
    });
    expect(res.status).toBe(400);
  });

  it("lets the owner assign the co-owner role", async () => {
    const updateSpy = updateChain({ error: null });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { owner_user_id: OWNER_ID } })) // sets
      .mockReturnValueOnce(chain({ data: acceptedEditor })) // existing collaborator
      .mockReturnValueOnce(updateSpy); // update
    const res = await PATCH(req("set-1", { collaboratorId: "c-1", role: "co-owner" }), {
      params: Promise.resolve({ id: "set-1" }),
    });
    expect(res.status).toBe(200);
    expect(updateSpy.update).toHaveBeenCalledWith(expect.objectContaining({ role: "co-owner" }));
  });

  it("lets a co-owner change a regular collaborator's role", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-3" } } });
    const updateSpy = updateChain({ error: null });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { owner_user_id: OWNER_ID } })) // sets — caller is not owner
      .mockReturnValueOnce(chain({ data: acceptedEditor })) // existing collaborator (editor)
      .mockReturnValueOnce(chain({ data: { id: "caller-collab" } })) // caller is an accepted co-owner
      .mockReturnValueOnce(updateSpy); // update
    const res = await PATCH(req("set-1", { collaboratorId: "c-1", role: "viewer" }), {
      params: Promise.resolve({ id: "set-1" }),
    });
    expect(res.status).toBe(200);
    expect(updateSpy.update).toHaveBeenCalledWith(expect.objectContaining({ role: "viewer" }));
  });

  it("forbids a co-owner from assigning the co-owner role", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-3" } } });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { owner_user_id: OWNER_ID } })) // sets
      .mockReturnValueOnce(chain({ data: acceptedEditor })) // existing collaborator
      .mockReturnValueOnce(chain({ data: { id: "caller-collab" } })); // caller is a co-owner
    const res = await PATCH(req("set-1", { collaboratorId: "c-1", role: "co-owner" }), {
      params: Promise.resolve({ id: "set-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("forbids a co-owner from changing another co-owner", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-3" } } });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { owner_user_id: OWNER_ID } })) // sets
      .mockReturnValueOnce(chain({ data: acceptedCoOwner })) // existing collaborator is a co-owner
      .mockReturnValueOnce(chain({ data: { id: "caller-collab" } })); // caller is a co-owner
    const res = await PATCH(req("set-1", { collaboratorId: "c-1", role: "editor" }), {
      params: Promise.resolve({ id: "set-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("forbids a plain editor from changing roles", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-2" } } });
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { owner_user_id: OWNER_ID } })) // sets
      .mockReturnValueOnce(chain({ data: acceptedEditor })) // existing collaborator
      .mockReturnValueOnce(chain({ data: null })); // caller is not a co-owner
    const res = await PATCH(req("set-1", { collaboratorId: "c-1", role: "viewer" }), {
      params: Promise.resolve({ id: "set-1" }),
    });
    expect(res.status).toBe(403);
  });
});
