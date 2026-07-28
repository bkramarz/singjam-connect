import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockAdminGetUser, mockSyncContact, mockEnqueueWelcomeEmail, tables, upserts, resetTables, chain } = vi.hoisted(() => {
  const tables: Record<string, any[]> = {};
  const upserts: { table: string; payload: any }[] = [];

  function chain(table: string, result: any) {
    const obj: any = {};
    ["select", "eq", "is", "maybeSingle", "update", "insert"].forEach((m) => {
      obj[m] = vi.fn(() => obj);
    });
    obj.upsert = vi.fn((payload: any) => { upserts.push({ table, payload }); return obj; });
    obj.then = (resolve: any) => resolve(result);
    return obj;
  }

  return {
    mockGetUser: vi.fn(),
    mockAdminGetUser: vi.fn(),
    mockSyncContact: vi.fn().mockResolvedValue(undefined),
    mockEnqueueWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    tables,
    upserts,
    resetTables: () => {
      Object.keys(tables).forEach((k) => delete tables[k]);
      upserts.length = 0;
    },
    chain,
  };
});

function fromMock(table: string) {
  const queue = tables[table] ?? [];
  const result = queue.length > 1 ? queue.shift() : queue[0];
  return chain(table, result ?? { data: null, error: null });
}

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: vi.fn(() => ({
    from: vi.fn(fromMock),
    auth: { getUser: mockAdminGetUser },
  })),
}));

vi.mock("@/lib/activecampaign", () => ({ syncContact: mockSyncContact }));

vi.mock("@/lib/resend", () => ({ resend: {} }));

vi.mock("@/lib/emailOutbox", () => ({ enqueueWelcomeEmail: mockEnqueueWelcomeEmail }));

import { POST } from "./route";

function req(body: Record<string, unknown>, headers?: Record<string, string>) {
  return new Request("https://singjam.org/api/auth/complete", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetTables();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1", email: "singer@example.com" } } });
  mockAdminGetUser.mockResolvedValue({ data: { user: null } });
});

describe("POST /api/auth/complete", () => {
  it("returns 401 when there's no authenticated user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(req({}));
    expect(res.status).toBe(401);
  });

  it("syncs to ActiveCampaign for a brand-new profile (trigger-created row, no username)", async () => {
    tables.profiles = [{ data: { username: null }, error: null }];
    const res = await POST(req({}));
    expect(res.status).toBe(200);
    expect(mockSyncContact).toHaveBeenCalledWith("singer@example.com");
  });

  it("never writes a username — setup owns it, so nothing here can clobber the user's choice", async () => {
    tables.profiles = [{ data: { username: null }, error: null }];
    await POST(req({}));
    expect(upserts).toHaveLength(0);
  });

  it("does not send the welcome email — that happens on profile save, with the chosen name", async () => {
    tables.profiles = [{ data: { username: null }, error: null }];
    await POST(req({}));
    expect(mockEnqueueWelcomeEmail).not.toHaveBeenCalled();
  });

  it("does not re-sync when the profile already has a username", async () => {
    tables.profiles = [{ data: { username: "existing" }, error: null }];
    const res = await POST(req({}));
    expect(res.status).toBe(200);
    expect(mockSyncContact).not.toHaveBeenCalled();
  });

  it("links an invite token and returns its jam ID regardless of profile state", async () => {
    tables.profiles = [{ data: { username: "existing" }, error: null }];
    tables.jam_invites = [
      { error: null },
      { data: { jam_id: "jam-9" }, error: null },
    ];
    const res = await POST(req({ inviteToken: "tok123" }));
    const body = await res.json();
    expect(body.jamId).toBe("jam-9");
  });

  it("authenticates via a Bearer token when there's no cookie session (native clients)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockAdminGetUser.mockResolvedValue({ data: { user: { id: "user-1", email: "singer@example.com" } } });
    tables.profiles = [{ data: { username: "existing" }, error: null }];
    const res = await POST(req({}, { Authorization: "Bearer good-token" }));
    expect(res.status).toBe(200);
    expect(mockAdminGetUser).toHaveBeenCalledWith("good-token");
  });

  it("returns 401 when the Bearer token is invalid and there's no cookie session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockAdminGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(req({}, { Authorization: "Bearer bad-token" }));
    expect(res.status).toBe(401);
  });
});
