import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAdminFrom } = vi.hoisted(() => ({ mockAdminFrom: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: vi.fn(() => ({ from: mockAdminFrom })),
}));

import { GET } from "./route";

function chain(result: any) {
  const c: any = {};
  for (const m of ["select", "eq"]) c[m] = vi.fn().mockReturnValue(c);
  c.maybeSingle = vi.fn().mockResolvedValue(result);
  c.then = (resolve: any) => Promise.resolve(result).then(resolve);
  return c;
}

const JAM_ID = "jam-1";
const TOKEN = "token-abc";

const params = Promise.resolve({ id: JAM_ID });

function makeReq(query: string) {
  return new Request(`http://localhost/api/jam/${JAM_ID}/public${query}`);
}

function mockJamFetches(jam: object, host: object | null) {
  mockAdminFrom
    .mockReturnValueOnce(chain({ data: jam })) // jams
    .mockReturnValueOnce(chain({ data: [{ genres: { name: "Folk" } }] })) // jam_genres
    .mockReturnValueOnce(chain({ data: [{ themes: { name: "Acoustic" } }] })) // jam_themes
    .mockReturnValueOnce(chain({ count: 3 })) // jam_rsvps
    .mockReturnValueOnce(chain({ data: { enabled: true } })) // feature_flags
    .mockReturnValueOnce(chain({ data: host })); // profiles
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/jam/[id]/public", () => {
  it("returns 400 when no invite token is supplied", async () => {
    const res = await GET(makeReq(""), { params });
    expect(res.status).toBe(400);
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it("returns 403 when the token doesn't match an invite for this jam", async () => {
    mockAdminFrom.mockReturnValueOnce(chain({ data: null }));
    const res = await GET(makeReq(`?invite=${TOKEN}`), { params });
    expect(res.status).toBe(403);
  });

  // The token is a bearer credential: whoever holds it may view the jam, no
  // matter which account (if any) the invite row is bound to. Signed-in
  // visitors read through this endpoint too, so a link forwarded to someone
  // who was never invited in-app must not 404.
  it("serves the jam for a valid token regardless of who the invite is bound to", async () => {
    mockAdminFrom.mockReturnValueOnce(chain({ data: { id: "invite-1" } })); // jam_invites
    mockJamFetches(
      { id: JAM_ID, name: "Leaders jam", visibility: "private", host_user_id: "host-1" },
      { display_name: "Ben", last_name: "Kramarz", username: "ben" }
    );

    const res = await GET(makeReq(`?invite=${TOKEN}`), { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      jam: { id: JAM_ID, name: "Leaders jam", visibility: "private" },
      genres: ["Folk"],
      themes: ["Acoustic"],
      attendingCount: 3,
      host: "Ben Kramarz",
      hostUsername: "ben",
      invitesEnabled: true,
    });
  });

  it("falls back to the host's username when they have no display name", async () => {
    mockAdminFrom.mockReturnValueOnce(chain({ data: { id: "invite-1" } }));
    mockJamFetches(
      { id: JAM_ID, name: "Leaders jam", visibility: "private", host_user_id: "host-1" },
      { display_name: null, last_name: null, username: "ben" }
    );

    const res = await GET(makeReq(`?invite=${TOKEN}`), { params });
    expect((await res.json()).host).toBe("ben");
  });

  it("returns 404 when the invite points at a jam that no longer exists", async () => {
    mockAdminFrom.mockReturnValueOnce(chain({ data: { id: "invite-1" } }));
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: null })) // jams
      .mockReturnValueOnce(chain({ data: [] }))
      .mockReturnValueOnce(chain({ data: [] }))
      .mockReturnValueOnce(chain({ count: 0 }))
      .mockReturnValueOnce(chain({ data: null }));

    const res = await GET(makeReq(`?invite=${TOKEN}`), { params });
    expect(res.status).toBe(404);
  });
});
