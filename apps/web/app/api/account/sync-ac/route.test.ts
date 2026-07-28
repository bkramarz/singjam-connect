import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockBearerGetUser, mockSyncContact, mockEnqueueWelcomeEmail, profileResult } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockBearerGetUser: vi.fn(),
  mockSyncContact: vi.fn().mockResolvedValue(undefined),
  mockEnqueueWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  profileResult: { current: { data: null as any, error: null as any } },
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
}));

vi.mock("@/lib/supabase/bearer", () => ({
  supabaseFromBearer: vi.fn(() => ({ auth: { getUser: mockBearerGetUser } })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: vi.fn(() => ({
    from: vi.fn(() => {
      const obj: any = {};
      ["select", "eq"].forEach((m) => { obj[m] = vi.fn(() => obj); });
      obj.maybeSingle = vi.fn(async () => profileResult.current);
      return obj;
    }),
  })),
}));

vi.mock("@/lib/activecampaign", () => ({ syncContact: mockSyncContact }));
vi.mock("@/lib/resend", () => ({ resend: {} }));
vi.mock("@/lib/emailOutbox", () => ({ enqueueWelcomeEmail: mockEnqueueWelcomeEmail }));

import { POST } from "./route";

function req(body: Record<string, unknown> = {}, headers?: Record<string, string>) {
  return new Request("https://singjam.org/api/account/sync-ac", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1", email: "singer@example.com" } } });
  mockBearerGetUser.mockResolvedValue({ data: { user: null } });
  profileResult.current = { data: { username: "benj", display_name: "Ben" }, error: null };
});

describe("POST /api/account/sync-ac", () => {
  it("returns 401 without an authenticated user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(req())).status).toBe(401);
  });

  it("sends the welcome email with the first name the user saved", async () => {
    const res = await POST(req({ firstName: "Ben" }));
    expect(res.status).toBe(200);
    expect(mockEnqueueWelcomeEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { userId: "user-1", email: "singer@example.com", name: "Ben" },
    );
  });

  it("falls back to the username when no display name was saved", async () => {
    profileResult.current = { data: { username: "benj", display_name: null }, error: null };
    await POST(req());
    expect(mockEnqueueWelcomeEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ name: "benj" }),
    );
  });

  it("holds the welcome email back until setup is actually complete", async () => {
    profileResult.current = { data: { username: null, display_name: null }, error: null };
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(mockSyncContact).toHaveBeenCalled();
    expect(mockEnqueueWelcomeEmail).not.toHaveBeenCalled();
  });

  it("works for native clients authenticating with a Bearer token", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockBearerGetUser.mockResolvedValue({ data: { user: { id: "user-2", email: "native@example.com" } } });
    const res = await POST(req({}, { Authorization: "Bearer good-token" }));
    expect(res.status).toBe(200);
    expect(mockEnqueueWelcomeEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ userId: "user-2", email: "native@example.com" }),
    );
  });
});
