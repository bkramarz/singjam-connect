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

import { POST } from "./route";

const OWNER_ID = "owner-1";

// One chainable mock covering every shape the route uses: terminal
// .maybeSingle()/.single() for the lookups, and a thenable for the calls that
// are awaited directly (upsert, the knowledge select).
function chain(result: any) {
  const c: any = { calls: {} as Record<string, any[]> };
  for (const m of ["select", "eq", "in", "order", "limit", "insert", "upsert"]) {
    c[m] = vi.fn((...args: any[]) => {
      c.calls[m] = args;
      return c;
    });
  }
  c.maybeSingle = vi.fn().mockResolvedValue(result);
  c.single = vi.fn().mockResolvedValue(result);
  c.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
  return c;
}

// Successive admin.from() calls hand back the queued chains in order.
function queueAdmin(chains: any[]) {
  const q = [...chains];
  mockAdminFrom.mockImplementation(() => q.shift() ?? chain({ data: null }));
}

function req(body: object, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/sets/set-1/songs", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const params = { params: Promise.resolve({ id: "set-1" }) };

const isOwner = () => chain({ data: { id: "set-1" } });
const notOwner = () => chain({ data: null });

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieClient.auth.getUser.mockResolvedValue({ data: { user: { id: OWNER_ID } } });
});

describe("POST /api/sets/[id]/songs", () => {
  it("returns 401 when neither a cookie session nor a bearer token resolves", async () => {
    mockCookieClient.auth.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(req({ songId: "song-1" }), params);
    expect(res.status).toBe(401);
  });

  it("authorizes the native app from its bearer token", async () => {
    mockCookieClient.auth.getUser.mockResolvedValue({ data: { user: null } });
    mockSupabaseFromBearer.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: OWNER_ID } } }) },
    });
    queueAdmin([isOwner(), notOwner(), chain({ data: null }), chain({ data: [] }), chain({ data: [] })]);

    const res = await POST(
      req({ songIds: ["song-1"] }, { Authorization: "Bearer native-token" }),
      params
    );
    expect(res.status).toBe(200);
  });

  it("returns 403 for a user who neither owns the set nor collaborates on it", async () => {
    queueAdmin([notOwner(), chain({ data: null })]);
    const res = await POST(req({ songIds: ["song-1"] }), params);
    expect(res.status).toBe(403);
  });

  it("lets an accepted co-owner add songs — the role RLS alone would reject", async () => {
    const collab = chain({ data: { id: "collab-1" } });
    const upsert = chain({ data: [{ id: "ss-1", song_id: "song-1" }] });
    queueAdmin([notOwner(), collab, chain({ data: null }), upsert, chain({ data: [] })]);

    const res = await POST(req({ songIds: ["song-1"] }), params);

    expect(res.status).toBe(200);
    expect(collab.calls.eq).toEqual(["status", "accepted"]);
    expect(upsert.calls.upsert[0]).toHaveLength(1);
  });

  it("only counts editors and co-owners as collaborators, never viewers", async () => {
    const collab = chain({ data: null });
    queueAdmin([notOwner(), collab]);

    const res = await POST(req({ songIds: ["song-1"] }), params);

    // A viewer's row exists but is filtered out by the role predicate, so the
    // lookup comes back empty and the add is refused — same bar as DELETE.
    expect(collab.calls.in).toEqual(["role", ["editor", "co-owner"]]);
    expect(res.status).toBe(403);
  });

  it("returns 400 when the body carries neither songId nor songIds", async () => {
    const res = await POST(req({}), params);
    expect(res.status).toBe(400);
  });

  it("returns 400 when songIds is empty", async () => {
    const res = await POST(req({ songIds: [] }), params);
    expect(res.status).toBe(400);
  });

  describe("single-song adds (web)", () => {
    it("appends after the set's current last position", async () => {
      const insert = chain({ data: { id: "ss-1", song_id: "song-1", position: 6 } });
      queueAdmin([isOwner(), notOwner(), chain({ data: { position: 5 } }), insert, chain({ data: [] })]);

      const res = await POST(req({ songId: "song-1" }), params);

      expect(res.status).toBe(200);
      expect(insert.calls.insert[0]).toMatchObject({
        set_id: "set-1",
        song_id: "song-1",
        position: 6,
        added_by_user_id: OWNER_ID,
      });
      expect(await res.json()).toMatchObject({ song: { id: "ss-1" } });
    });

    it("starts an empty set at position 0", async () => {
      const insert = chain({ data: { id: "ss-1" } });
      queueAdmin([isOwner(), notOwner(), chain({ data: null }), insert, chain({ data: [] })]);

      await POST(req({ songId: "song-1" }), params);

      expect(insert.calls.insert[0]).toMatchObject({ position: 0 });
    });

    // The set detail page's "Add songs" panel sends this exact shape and reads
    // { song, knowledge } back off it — the most-used add path on web.
    it("records the confidence level and returns song + knowledge", async () => {
      const knowledgeUpsert = chain({ data: null });
      const insert = chain({ data: { id: "ss-1", song_id: "song-1" } });
      queueAdmin([
        isOwner(),
        notOwner(),
        knowledgeUpsert,
        chain({ data: null }),
        insert,
        chain({ data: [{ user_id: OWNER_ID, song_id: "song-1", confidence: "lead" }] }),
      ]);

      const res = await POST(req({ songId: "song-1", confidence: "lead" }), params);

      expect(knowledgeUpsert.calls.upsert[0]).toEqual([
        { user_id: OWNER_ID, song_id: "song-1", confidence: "lead" },
      ]);
      expect(await res.json()).toEqual({
        song: { id: "ss-1", song_id: "song-1" },
        knowledge: [{ user_id: OWNER_ID, song_id: "song-1", confidence: "lead" }],
      });
    });

    it("ignores a confidence value that isn't a real level", async () => {
      const insert = chain({ data: { id: "ss-1" } });
      queueAdmin([isOwner(), notOwner(), chain({ data: null }), insert, chain({ data: [] })]);

      const res = await POST(req({ songId: "song-1", confidence: "expert" }), params);

      // owner, collaborator, max position, insert, knowledge — and crucially no
      // sixth call writing "expert" into user_songs.
      expect(mockAdminFrom).toHaveBeenCalledTimes(5);
      expect(res.status).toBe(200);
    });

    it("still reports a duplicate as 409", async () => {
      queueAdmin([
        isOwner(),
        notOwner(),
        chain({ data: null }),
        chain({ data: null, error: { code: "23505", message: "duplicate key" } }),
      ]);

      const res = await POST(req({ songId: "song-1" }), params);

      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({ error: "Song already in set" });
    });
  });

  describe("batch adds (native multi-select)", () => {
    it("writes the whole selection in one call, numbered contiguously from the end", async () => {
      const upsert = chain({ data: [{ id: "ss-1" }, { id: "ss-2" }, { id: "ss-3" }] });
      queueAdmin([isOwner(), notOwner(), chain({ data: { position: 4 } }), upsert, chain({ data: [] })]);

      const res = await POST(req({ songIds: ["song-1", "song-2", "song-3"] }), params);

      expect(res.status).toBe(200);
      expect(mockAdminFrom).toHaveBeenCalledTimes(5);
      expect(upsert.calls.upsert[0]).toEqual([
        { set_id: "set-1", song_id: "song-1", position: 5, added_by_user_id: OWNER_ID },
        { set_id: "set-1", song_id: "song-2", position: 6, added_by_user_id: OWNER_ID },
        { set_id: "set-1", song_id: "song-3", position: 7, added_by_user_id: OWNER_ID },
      ]);
      expect(await res.json()).toMatchObject({ added: 3 });
    });

    it("skips songs already in the set instead of failing the whole batch", async () => {
      const upsert = chain({ data: [{ id: "ss-2" }] });
      queueAdmin([isOwner(), notOwner(), chain({ data: null }), upsert, chain({ data: [] })]);

      const res = await POST(req({ songIds: ["song-1", "song-2"] }), params);

      expect(res.status).toBe(200);
      expect(upsert.calls.upsert[1]).toEqual({
        onConflict: "set_id,song_id",
        ignoreDuplicates: true,
      });
      expect(await res.json()).toMatchObject({ added: 1 });
    });

    it("ignores non-string entries in songIds", async () => {
      const upsert = chain({ data: [{ id: "ss-1" }] });
      queueAdmin([isOwner(), notOwner(), chain({ data: null }), upsert, chain({ data: [] })]);

      await POST(req({ songIds: ["song-1", null, "", 7] }), params);

      expect(upsert.calls.upsert[0]).toEqual([
        { set_id: "set-1", song_id: "song-1", position: 0, added_by_user_id: OWNER_ID },
      ]);
    });

    it("applies a confidence level to every song in the selection", async () => {
      const knowledgeUpsert = chain({ data: null });
      const upsert = chain({ data: [{ id: "ss-1" }, { id: "ss-2" }] });
      queueAdmin([
        isOwner(),
        notOwner(),
        knowledgeUpsert,
        chain({ data: null }),
        upsert,
        chain({ data: [] }),
      ]);

      await POST(req({ songIds: ["song-1", "song-2"], confidence: "support" }), params);

      expect(knowledgeUpsert.calls.upsert[0]).toEqual([
        { user_id: OWNER_ID, song_id: "song-1", confidence: "support" },
        { user_id: OWNER_ID, song_id: "song-2", confidence: "support" },
      ]);
    });
  });
});
