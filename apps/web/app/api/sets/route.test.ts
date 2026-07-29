import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCookieClient, mockSupabaseFromBearer, mockAdminFrom } = vi.hoisted(() => ({
  mockCookieClient: { auth: { getUser: vi.fn() }, from: vi.fn() },
  mockSupabaseFromBearer: vi.fn(),
  mockAdminFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn().mockResolvedValue(mockCookieClient),
}));

vi.mock("@/lib/supabase/bearer", () => ({
  supabaseFromBearer: mockSupabaseFromBearer,
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: vi.fn(() => ({ from: mockAdminFrom })),
}));

import { GET, POST } from "./route";

// Chainable query mock awaited directly (no terminal .single()), matching
// `.from().select().eq().order()` in the route.
function queryChain(result: any) {
  const c: any = {};
  for (const m of ["select", "eq", "neq", "order", "limit"]) c[m] = vi.fn(() => c);
  c.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
  return c;
}

// Chainable insert().select().single() mock.
function insertChain(result: any) {
  const c: any = {};
  for (const m of ["insert", "select"]) c[m] = vi.fn(() => c);
  c.single = vi.fn().mockResolvedValue(result);
  return c;
}

// A client whose successive `from()` calls return the queued results in order.
// GET's Promise.all builds them owned → collaborating → public.
function clientWith(user: any, queue: any[]) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => queryChain(queue.shift())),
  };
}

function getReq(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/sets", { headers });
}

function postReq(body: object, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/sets", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const OWNER = "owner-1";

const PROFILE = { display_name: "Ada", last_name: "Lovelace", username: "ada" };

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieClient.auth.getUser.mockResolvedValue({ data: { user: null } });
  mockCookieClient.from.mockImplementation(() => queryChain({ data: [] }));
  mockSupabaseFromBearer.mockReset();
});

describe("GET /api/sets", () => {
  it("returns public sets only for an anonymous caller", async () => {
    mockCookieClient.from.mockImplementationOnce(() =>
      queryChain({
        data: [
          { id: "s-pub", name: "Open mic", description: null, owner_user_id: "someone", profiles: PROFILE },
        ],
      })
    );

    const res = await GET(getReq());
    const json = await res.json();

    expect(json.authenticated).toBe(false);
    expect(json.owned).toEqual([]);
    expect(json.collaborating).toEqual([]);
    expect(json.public).toEqual([
      {
        id: "s-pub",
        name: "Open mic",
        description: null,
        ownerUserId: "someone",
        ownerName: "Ada Lovelace",
        ownerUsername: "ada",
      },
    ]);
  });

  it("splits owned, collaborating and public sets for a signed-in caller", async () => {
    mockCookieClient.auth.getUser.mockResolvedValue({ data: { user: { id: OWNER } } });
    const queue = [
      { data: [{ id: "s-own", name: "Mine", description: "d", created_at: "2026-01-01", owner_user_id: OWNER, link_sharing: "private" }] },
      { data: [{ set_id: "s-collab", sets: { id: "s-collab", name: "Theirs", description: null, created_at: "2026-01-02", owner_user_id: "other", link_sharing: "link", profiles: PROFILE } }] },
      { data: [{ id: "s-pub", name: "Open mic", description: null, owner_user_id: "third", profiles: PROFILE }] },
    ];
    mockCookieClient.from.mockImplementation(() => queryChain(queue.shift()));

    const res = await GET(getReq());
    const json = await res.json();

    expect(json.authenticated).toBe(true);
    expect(json.owned.map((s: any) => s.id)).toEqual(["s-own"]);
    expect(json.public.map((s: any) => s.id)).toEqual(["s-pub"]);
    // Collaborating rows carry the owner's name so the card can say who shared it.
    expect(json.collaborating).toEqual([
      expect.objectContaining({
        id: "s-collab",
        link_sharing: "link",
        ownerUserId: "other",
        ownerName: "Ada Lovelace",
        ownerUsername: "ada",
      }),
    ]);
  });

  it("never lists the same set twice across sections", async () => {
    mockCookieClient.auth.getUser.mockResolvedValue({ data: { user: { id: OWNER } } });
    const queue = [
      { data: [{ id: "s-dup", name: "Mine", description: null, created_at: "2026-01-01", owner_user_id: OWNER, link_sharing: "public" }] },
      // A stale collaborator row on a set the caller now owns.
      { data: [{ set_id: "s-dup", sets: { id: "s-dup", name: "Mine", description: null, created_at: "2026-01-01", owner_user_id: OWNER, link_sharing: "public", profiles: PROFILE } }] },
      // The public feed also surfaces it.
      { data: [{ id: "s-dup", name: "Mine", description: null, owner_user_id: OWNER, profiles: PROFILE }] },
    ];
    mockCookieClient.from.mockImplementation(() => queryChain(queue.shift()));

    const res = await GET(getReq());
    const json = await res.json();

    expect(json.owned.map((s: any) => s.id)).toEqual(["s-dup"]);
    expect(json.collaborating).toEqual([]);
    expect(json.public).toEqual([]);
  });

  it("resolves a bearer caller and reads through the bearer client", async () => {
    // Cookie session is empty — the native app authenticates by header only.
    const bearerClient = clientWith({ id: "native-user" }, [
      { data: [{ id: "s-native", name: "From the phone", description: null, created_at: "2026-01-01", owner_user_id: "native-user", link_sharing: "private" }] },
      { data: [] },
      { data: [] },
    ]);
    mockSupabaseFromBearer.mockReturnValue(bearerClient);

    const res = await GET(getReq({ Authorization: "Bearer native-token" }));
    const json = await res.json();

    expect(mockSupabaseFromBearer).toHaveBeenCalledWith("native-token");
    expect(json.authenticated).toBe(true);
    expect(json.owned.map((s: any) => s.id)).toEqual(["s-native"]);
    // The queries must run on the bearer client, not the anon cookie client —
    // otherwise RLS returns nothing and the phone shows an empty list.
    expect(bearerClient.from).toHaveBeenCalled();
    expect(mockCookieClient.from).not.toHaveBeenCalled();
  });
});

describe("POST /api/sets", () => {
  it("returns 401 when neither a cookie session nor a bearer token is present", async () => {
    const res = await POST(postReq({ name: "New set" }));
    expect(res.status).toBe(401);
  });

  it("requires a name", async () => {
    mockCookieClient.auth.getUser.mockResolvedValue({ data: { user: { id: OWNER } } });
    const res = await POST(postReq({ name: "   " }));
    expect(res.status).toBe(400);
  });

  it("creates a set for a bearer caller", async () => {
    const chain = insertChain({ data: { id: "s-new" }, error: null });
    const bearerClient = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "native-user" } } }) },
      from: vi.fn(() => chain),
    };
    mockSupabaseFromBearer.mockReturnValue(bearerClient);

    const res = await POST(postReq({ name: "  Friday night  ", description: "" }, { Authorization: "Bearer native-token" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).toBe("s-new");
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Friday night",
        description: null,
        owner_user_id: "native-user",
        jam_id: null,
      })
    );
  });
});
