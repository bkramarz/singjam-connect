import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockGetUser, mockBearerGetUser, mockFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockBearerGetUser: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
}));

vi.mock("@/lib/supabase/bearer", () => ({
  supabaseFromBearer: vi.fn(() => ({ auth: { getUser: mockBearerGetUser } })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: vi.fn(() => ({ from: mockFrom })),
}));

import { POST } from "./route";

// Chain that resolves the duplicate-check query (select→ilike→ilike/is→limit→maybeSingle).
function dupeChain(existing: any) {
  const c: any = {};
  for (const m of ["select", "ilike", "is", "limit"]) c[m] = vi.fn().mockReturnValue(c);
  c.maybeSingle = vi.fn().mockResolvedValue({ data: existing });
  return c;
}

function req(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/songs/submit", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Enrichment call — return empty so canonical values fall back to the input.
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/songs/submit", () => {
  it("returns 401 when neither cookie session nor bearer token authenticates", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(req({ title: "Proud Mary" }));
    expect(res.status).toBe(401);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns 400 when the title is blank", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const res = await POST(req({ title: "  " }));
    expect(res.status).toBe(400);
  });

  it("authenticates via bearer token when there is no cookie session (native)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockBearerGetUser.mockResolvedValue({ data: { user: { id: "u2" } } });
    // Existing match short-circuits to 409 — enough to prove auth passed the gate.
    mockFrom.mockReturnValue(dupeChain({ id: "song-1", slug: "proud-mary" }));

    const res = await POST(req({ title: "Proud Mary", artist: "CCR" }, { Authorization: "Bearer tok" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ id: "song-1", slug: "proud-mary" });
  });
});
