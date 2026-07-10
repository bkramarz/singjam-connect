import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockExchangeCodeForSession,
  mockSyncContact,
  mockSend,
  tables,
  resetTables,
  chain,
} = vi.hoisted(() => {
  const tables: Record<string, any[]> = {};

  function chain(result: any) {
    const obj: any = {};
    ["select", "eq", "is", "order", "limit", "upsert", "update", "insert", "maybeSingle", "single"].forEach((m) => {
      obj[m] = vi.fn(() => obj);
    });
    obj.then = (resolve: any) => resolve(result);
    return obj;
  }

  return {
    mockExchangeCodeForSession: vi.fn(),
    mockSyncContact: vi.fn().mockResolvedValue(undefined),
    mockSend: vi.fn().mockResolvedValue({}),
    tables,
    resetTables: () => {
      Object.keys(tables).forEach((k) => delete tables[k]);
    },
    chain,
  };
});

function fromMock(table: string) {
  const queue = tables[table] ?? [];
  const result = queue.length > 1 ? queue.shift() : queue[0];
  return chain(result ?? { data: null, error: null });
}

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [] }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { exchangeCodeForSession: mockExchangeCodeForSession },
    from: vi.fn(fromMock),
  })),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(fromMock),
  })),
}));

vi.mock("@/lib/activecampaign", () => ({ syncContact: mockSyncContact }));

vi.mock("@/lib/resend", () => ({
  resend: { emails: { send: mockSend } },
  FROM_ADDRESS: "SingJam <hello@singjam.org>",
}));

vi.mock("@/emails/welcome", () => ({
  welcomeEmailHtml: vi.fn(() => "<html></html>"),
}));

import { GET } from "./route";

function req(params: Record<string, string>) {
  const url = new URL("https://singjam.org/auth/callback");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString());
}

function user(overrides: Partial<{ id: string; email: string; created_at: string; last_sign_in_at: string }> = {}) {
  return {
    id: "user-1",
    email: "singer@example.com",
    created_at: "2026-01-01T00:00:00Z",
    last_sign_in_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetTables();
  mockExchangeCodeForSession.mockResolvedValue({ data: { user: user() }, error: null });
});

describe("GET /auth/callback", () => {
  it("redirects to /auth with an error when code exchange fails", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: null, error: { message: "invalid code" } });
    const res = await GET(req({ code: "abc" }));
    expect(res.headers.get("location")).toBe("https://singjam.org/auth?error=invalid%20code");
  });

  it("redirects to /account with default next for a brand-new user (profile row exists but has no username)", async () => {
    tables.profiles = [
      { data: { username: null }, error: null }, // profile lookup — trigger-created row, no username yet
      { data: null, error: null }, // username-uniqueness check
      { error: null }, // upsert
    ];
    const res = await GET(req({ code: "abc" }));
    expect(res.headers.get("location")).toBe("https://singjam.org/account?next=%2Frepertoire");
    expect(mockSyncContact).toHaveBeenCalledWith("singer@example.com");
  });

  it("preserves an explicit next param through account setup for a new user", async () => {
    tables.profiles = [
      { data: { username: null }, error: null },
      { data: null, error: null },
      { error: null },
    ];
    const res = await GET(req({ code: "abc", next: "/jams" }));
    expect(res.headers.get("location")).toBe("https://singjam.org/account?next=%2Fjams");
  });

  it("sends a new user straight to their invited jam after account setup", async () => {
    tables.profiles = [
      { data: { username: null }, error: null },
      { data: null, error: null },
      { error: null },
    ];
    tables.jam_invites = [
      { error: null }, // invite link update
      { data: { jam_id: "jam-42" }, error: null }, // invite jam lookup
    ];
    const res = await GET(req({ code: "abc", invite: "tok123" }));
    expect(res.headers.get("location")).toBe("https://singjam.org/account?next=%2Fjam%2Fjam-42");
  });

  it("sends a returning user with a username straight to /repertoire by default", async () => {
    tables.profiles = [{ data: { username: "existing" }, error: null }];
    const res = await GET(req({ code: "abc" }));
    expect(res.headers.get("location")).toBe("https://singjam.org/repertoire");
  });

  it("sends a returning user with a username to an explicit next destination", async () => {
    tables.profiles = [{ data: { username: "existing" }, error: null }];
    const res = await GET(req({ code: "abc", next: "/jams" }));
    expect(res.headers.get("location")).toBe("https://singjam.org/jams");
  });

  it("links a returning user's invite and redirects to the jam", async () => {
    tables.profiles = [{ data: { username: "existing" }, error: null }];
    tables.jam_invites = [
      { error: null },
      { data: { jam_id: "jam-7" }, error: null },
    ];
    const res = await GET(req({ code: "abc", invite: "tok123" }));
    expect(res.headers.get("location")).toBe("https://singjam.org/jam/jam-7");
  });

  it("redirects to /account when there's no code at all and no next param", async () => {
    const res = await GET(req({}));
    expect(res.headers.get("location")).toBe("https://singjam.org/account");
  });
});
