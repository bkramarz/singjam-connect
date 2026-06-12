import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockVerifyOtp, capturedCookieHandlers } = vi.hoisted(() => ({
  mockVerifyOtp: vi.fn(),
  capturedCookieHandlers: { current: null as any },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [] }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url: string, _key: string, opts: any) => {
    capturedCookieHandlers.current = opts.cookies;
    return { auth: { verifyOtp: mockVerifyOtp } };
  }),
}));

import { GET } from "./route";

function req(params: Record<string, string>) {
  const url = new URL("https://singjam.org/auth/confirm");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString());
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedCookieHandlers.current = null;
  mockVerifyOtp.mockResolvedValue({ error: null });
});

describe("GET /auth/confirm", () => {
  it("verifies the token and redirects to the reset-password page", async () => {
    const res = await GET(req({ token_hash: "abc123", type: "recovery" }));
    expect(mockVerifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "abc123" });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://singjam.org/auth/reset-password");
  });

  it("sets session cookies on the redirect response", async () => {
    mockVerifyOtp.mockImplementation(async () => {
      capturedCookieHandlers.current.setAll([
        { name: "sb-test-auth-token", value: "session-jwt", options: { path: "/" } },
      ]);
      return { error: null };
    });
    const res = await GET(req({ token_hash: "abc123", type: "recovery" }));
    expect(res.headers.get("set-cookie")).toContain("sb-test-auth-token=session-jwt");
  });

  it("redirects to /auth with an error when the token is invalid or expired", async () => {
    mockVerifyOtp.mockResolvedValue({ error: { message: "Token has expired or is invalid" } });
    const res = await GET(req({ token_hash: "stale", type: "recovery" }));
    const location = res.headers.get("location")!;
    expect(location).toContain("https://singjam.org/auth?error=");
    expect(decodeURIComponent(location)).toContain("invalid or has expired");
  });

  it("redirects to /auth with an error when token_hash is missing", async () => {
    const res = await GET(req({ type: "recovery" }));
    expect(mockVerifyOtp).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toContain("https://singjam.org/auth?error=");
  });

  it("redirects to /auth with an error when type is missing", async () => {
    const res = await GET(req({ token_hash: "abc123" }));
    expect(mockVerifyOtp).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toContain("https://singjam.org/auth?error=");
  });

  it("honours a safe relative next param", async () => {
    const res = await GET(req({ token_hash: "abc123", type: "recovery", next: "/account" }));
    expect(res.headers.get("location")).toBe("https://singjam.org/account");
  });

  it("ignores an absolute URL in the next param", async () => {
    const res = await GET(req({ token_hash: "abc123", type: "recovery", next: "https://evil.com/phish" }));
    expect(res.headers.get("location")).toBe("https://singjam.org/auth/reset-password");
  });

  it("ignores a protocol-relative URL in the next param", async () => {
    const res = await GET(req({ token_hash: "abc123", type: "recovery", next: "//evil.com" }));
    expect(res.headers.get("location")).toBe("https://singjam.org/auth/reset-password");
  });
});
