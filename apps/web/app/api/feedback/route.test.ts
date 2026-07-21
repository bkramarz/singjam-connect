import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockBearerGetUser, mockCookieFrom, mockBearerFrom, mockSend } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockBearerGetUser: vi.fn(),
  mockCookieFrom: vi.fn(),
  mockBearerFrom: vi.fn(),
  mockSend: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser }, from: mockCookieFrom }),
}));

vi.mock("@/lib/supabase/bearer", () => ({
  supabaseFromBearer: vi.fn(() => ({ auth: { getUser: mockBearerGetUser }, from: mockBearerFrom })),
}));

vi.mock("@/lib/resend", () => ({
  resend: { emails: { send: mockSend } },
  FROM_ADDRESS: "test@singjam.org",
}));

import { POST } from "./route";

function profileChain(result: any) {
  const c: any = {};
  c.select = vi.fn().mockReturnValue(c);
  c.eq = vi.fn().mockReturnValue(c);
  c.single = vi.fn().mockResolvedValue(result);
  return c;
}

function req(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/feedback", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/feedback", () => {
  it("returns 400 when description is blank", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(req({ description: "   " }));
    expect(res.status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("attributes the report to the cookie-authenticated user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "web@singjam.org" } } });
    mockCookieFrom.mockReturnValue(profileChain({ data: { display_name: "Web User", username: "webby" } }));

    const res = await POST(req({ description: "It broke", steps: "click", page: "/jams" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const sent = mockSend.mock.calls[0][0];
    expect(sent.to).toBe("music@singjam.org");
    expect(sent.subject).toContain("Web User (web@singjam.org)");
    expect(sent.html).toContain("It broke");
    expect(mockBearerFrom).not.toHaveBeenCalled();
  });

  it("authenticates via bearer token when there is no cookie session (native)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockBearerGetUser.mockResolvedValue({ data: { user: { id: "u2", email: "native@singjam.org" } } });
    mockBearerFrom.mockReturnValue(profileChain({ data: { display_name: "Native User", username: "natty" } }));

    const res = await POST(req({ description: "Native bug", page: "native:repertoire" }, { Authorization: "Bearer tok" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const sent = mockSend.mock.calls[0][0];
    expect(sent.subject).toContain("Native User (native@singjam.org)");
    expect(sent.html).toContain("Native bug");
    // profile was read with the bearer-scoped client, not the cookie one
    expect(mockBearerFrom).toHaveBeenCalledWith("profiles");
    expect(mockCookieFrom).not.toHaveBeenCalled();
  });

  it("still accepts anonymous reports when neither cookie nor bearer authenticates", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(req({ description: "Logged out report" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const sent = mockSend.mock.calls[0][0];
    expect(sent.subject).toContain("Not logged in");
    expect(mockCookieFrom).not.toHaveBeenCalled();
    expect(mockBearerFrom).not.toHaveBeenCalled();
  });
});
