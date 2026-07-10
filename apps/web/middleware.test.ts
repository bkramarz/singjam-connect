import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetClaims } = vi.hoisted(() => ({
  mockGetClaims: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { getClaims: mockGetClaims },
  })),
}));

import { NextRequest } from "next/server";
import { middleware } from "./middleware";

function req(path: string, { withAuthCookie = false }: { withAuthCookie?: boolean } = {}) {
  const request = new NextRequest(`https://singjam.org${path}`);
  if (withAuthCookie) {
    request.cookies.set("sb-access-token", "token");
  }
  return request;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetClaims.mockResolvedValue({ data: { claims: null } });
});

describe("middleware auth gate", () => {
  it("redirects an unauthenticated visitor away from another user's /u/[username] profile, preserving the destination", async () => {
    const res = await middleware(req("/u/someuser"));
    expect(res.headers.get("location")).toBe("https://singjam.org/auth?next=%2Fu%2Fsomeuser");
  });

  it("redirects an unauthenticated visitor away from /profile/[id], preserving the destination", async () => {
    const res = await middleware(req("/profile/abc123"));
    expect(res.headers.get("location")).toBe("https://singjam.org/auth?next=%2Fprofile%2Fabc123");
  });

  it("preserves query params on the gated route in the next redirect", async () => {
    const res = await middleware(req("/notifications?tab=invites"));
    expect(res.headers.get("location")).toBe("https://singjam.org/auth?next=%2Fnotifications%3Ftab%3Dinvites");
  });

  it("allows an authenticated visitor to view /u/[username]", async () => {
    mockGetClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    const res = await middleware(req("/u/someuser", { withAuthCookie: true }));
    expect(res.headers.get("location")).toBeNull();
  });

  it("does not gate public routes like /jams", async () => {
    const res = await middleware(req("/jams"));
    expect(res.headers.get("location")).toBeNull();
    expect(mockGetClaims).not.toHaveBeenCalled();
  });
});
