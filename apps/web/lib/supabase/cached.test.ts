import { describe, it, expect, vi, beforeEach } from "vitest";

const getUser = vi.fn();
const single = vi.fn();

vi.mock("./server", () => ({
  supabaseServer: vi.fn(async () => ({
    auth: { getUser },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single }),
      }),
    })),
  })),
}));

import { getServerUser, getServerUserRole } from "./cached";

describe("cached server helpers", () => {
  beforeEach(() => {
    getUser.mockReset();
    single.mockReset();
  });

  it("getServerUser returns the authenticated user", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    expect(await getServerUser()).toEqual({ id: "u1" });
  });

  it("getServerUser returns null when logged out", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await getServerUser()).toBeNull();
  });

  it("getServerUserRole returns the profile role", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    single.mockResolvedValue({ data: { role: "admin" } });
    expect(await getServerUserRole()).toBe("admin");
  });

  it("getServerUserRole is null when logged out and skips the profile query", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await getServerUserRole()).toBeNull();
    expect(single).not.toHaveBeenCalled();
  });

  it("getServerUserRole is null when the profile row is missing", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    single.mockResolvedValue({ data: null });
    expect(await getServerUserRole()).toBeNull();
  });
});
