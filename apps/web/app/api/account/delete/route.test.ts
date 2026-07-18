import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockAdminGetUser, mockDeleteUser, mockDeleteContact } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockAdminGetUser: vi.fn(),
  mockDeleteUser: vi.fn(),
  mockDeleteContact: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: vi.fn(() => ({
    auth: { getUser: mockAdminGetUser, admin: { deleteUser: mockDeleteUser } },
  })),
}));

vi.mock("@/lib/activecampaign", () => ({ deleteContact: mockDeleteContact }));

import { DELETE } from "./route";

function req(headers?: Record<string, string>) {
  return new Request("https://singjam.org/api/account/delete", { method: "DELETE", headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1", email: "singer@example.com" } } });
  mockAdminGetUser.mockResolvedValue({ data: { user: null } });
  mockDeleteContact.mockResolvedValue(true);
  mockDeleteUser.mockResolvedValue({ error: null });
});

describe("DELETE /api/account/delete", () => {
  it("returns 401 when there's no authenticated user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await DELETE(req());
    expect(res.status).toBe(401);
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("deletes the ActiveCampaign contact and the Supabase user", async () => {
    const res = await DELETE(req());
    expect(res.status).toBe(200);
    expect(mockDeleteContact).toHaveBeenCalledWith("singer@example.com");
    expect(mockDeleteUser).toHaveBeenCalledWith("user-1");
  });

  it("still deletes the Supabase user when the ActiveCampaign cleanup fails", async () => {
    mockDeleteContact.mockRejectedValue(new Error("AC is down"));
    const res = await DELETE(req());
    expect(res.status).toBe(200);
    expect(mockDeleteUser).toHaveBeenCalledWith("user-1");
  });

  it("authenticates via a Bearer token when there's no cookie session (native clients)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockAdminGetUser.mockResolvedValue({ data: { user: { id: "user-1", email: "singer@example.com" } } });
    const res = await DELETE(req({ Authorization: "Bearer good-token" }));
    expect(res.status).toBe(200);
    expect(mockAdminGetUser).toHaveBeenCalledWith("good-token");
    expect(mockDeleteUser).toHaveBeenCalledWith("user-1");
  });

  it("returns 500 when Supabase user deletion fails", async () => {
    mockDeleteUser.mockResolvedValue({ error: { message: "boom" } });
    const res = await DELETE(req());
    expect(res.status).toBe(500);
  });
});
