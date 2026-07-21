import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCookieGetUser, mockBearerGetUser, mockSupabaseFromBearer } = vi.hoisted(() => ({
  mockCookieGetUser: vi.fn(),
  mockBearerGetUser: vi.fn(),
  mockSupabaseFromBearer: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn().mockResolvedValue({ auth: { getUser: mockCookieGetUser } }),
}));

vi.mock("@/lib/supabase/bearer", () => ({
  supabaseFromBearer: mockSupabaseFromBearer,
}));

import { resolveApiUser } from "./apiUser";

function reqWith(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/x", { method: "PATCH", headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabaseFromBearer.mockReturnValue({ auth: { getUser: mockBearerGetUser } });
});

describe("resolveApiUser", () => {
  it("returns the cookie user without consulting the bearer token", async () => {
    mockCookieGetUser.mockResolvedValue({ data: { user: { id: "cookie-user" } } });
    const user = await resolveApiUser(reqWith({ Authorization: "Bearer abc" }));
    expect(user?.id).toBe("cookie-user");
    expect(mockSupabaseFromBearer).not.toHaveBeenCalled();
  });

  it("falls back to the bearer token when there is no cookie session", async () => {
    mockCookieGetUser.mockResolvedValue({ data: { user: null } });
    mockBearerGetUser.mockResolvedValue({ data: { user: { id: "bearer-user" } } });
    const user = await resolveApiUser(reqWith({ Authorization: "Bearer tok" }));
    expect(user?.id).toBe("bearer-user");
    expect(mockSupabaseFromBearer).toHaveBeenCalledWith("tok");
  });

  it("returns null when neither cookie nor bearer authenticates", async () => {
    mockCookieGetUser.mockResolvedValue({ data: { user: null } });
    const user = await resolveApiUser(reqWith());
    expect(user).toBeNull();
    expect(mockSupabaseFromBearer).not.toHaveBeenCalled();
  });

  it("returns null when a bearer token is present but invalid", async () => {
    mockCookieGetUser.mockResolvedValue({ data: { user: null } });
    mockBearerGetUser.mockResolvedValue({ data: { user: null } });
    const user = await resolveApiUser(reqWith({ Authorization: "Bearer bad" }));
    expect(user).toBeNull();
  });
});
