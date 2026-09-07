import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRequireAdmin, mockAdminFrom } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockAdminFrom: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: mockRequireAdmin,
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: vi.fn(() => ({ from: mockAdminFrom })),
}));

import { NextResponse } from "next/server";
import { PATCH } from "./route";

function chain(result: any) {
  const c: any = {};
  for (const m of ["update", "eq", "select"]) c[m] = vi.fn().mockReturnValue(c);
  c.maybeSingle = vi.fn().mockResolvedValue(result);
  return c;
}

function makeReq(body: unknown, raw = false) {
  return new Request("http://localhost/api/admin/users/target-1/role", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

const ADMIN_ID = "admin-1";
const TARGET_ID = "target-1";
const params = (id = TARGET_ID) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ ok: true, user: { id: ADMIN_ID } });
});

describe("PATCH /api/admin/users/[id]/role", () => {
  it("passes through the auth failure when the caller is not an admin", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const res = await PATCH(makeReq({ role: "admin" }), params());
    expect(res.status).toBe(403);
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it("rejects a role outside the grantable set", async () => {
    const res = await PATCH(makeReq({ role: "unused_event_host" }), params());
    expect(res.status).toBe(400);
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it("rejects a missing role", async () => {
    const res = await PATCH(makeReq({}), params());
    expect(res.status).toBe(400);
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it("rejects a body that is not JSON", async () => {
    const res = await PATCH(makeReq("not json", true), params());
    expect(res.status).toBe(400);
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it("refuses to change the caller's own role", async () => {
    const res = await PATCH(makeReq({ role: "member" }), params(ADMIN_ID));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("your own role") });
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it("returns 404 when no profile matches", async () => {
    mockAdminFrom.mockReturnValueOnce(chain({ data: null, error: null }));
    const res = await PATCH(makeReq({ role: "song_editor" }), params());
    expect(res.status).toBe(404);
  });

  it("returns 500 when the update fails", async () => {
    mockAdminFrom.mockReturnValueOnce(chain({ data: null, error: { message: "boom" } }));
    const res = await PATCH(makeReq({ role: "song_editor" }), params());
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "boom" });
  });

  it("updates the target profile's role", async () => {
    const c = chain({ data: { id: TARGET_ID }, error: null });
    mockAdminFrom.mockReturnValueOnce(c);
    const res = await PATCH(makeReq({ role: "song_editor" }), params());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, role: "song_editor" });
    expect(mockAdminFrom).toHaveBeenCalledWith("profiles");
    expect(c.update).toHaveBeenCalledWith({ role: "song_editor" });
    expect(c.eq).toHaveBeenCalledWith("id", TARGET_ID);
  });
});
