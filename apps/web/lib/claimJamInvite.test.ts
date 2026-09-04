import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAdminFrom } = vi.hoisted(() => ({ mockAdminFrom: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: vi.fn(() => ({ from: mockAdminFrom })),
}));

import { claimJamInvite } from "./claimJamInvite";

function chain(result: any) {
  const c: any = {};
  for (const m of ["select", "eq", "update", "is"]) c[m] = vi.fn().mockReturnValue(c);
  c.maybeSingle = vi.fn().mockResolvedValue(result);
  c.then = (resolve: any) => Promise.resolve(result).then(resolve);
  return c;
}

const JAM_ID = "jam-1";
const TOKEN = "token-abc";

beforeEach(() => vi.clearAllMocks());

describe("claimJamInvite", () => {
  it("returns null when the token doesn't match an invite", async () => {
    mockAdminFrom.mockReturnValueOnce(chain({ data: null }));
    expect(await claimJamInvite(TOKEN, "user-1")).toBeNull();
    expect(mockAdminFrom).toHaveBeenCalledTimes(1);
  });

  it("binds an unclaimed invite to the user", async () => {
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { id: "inv-1", jam_id: JAM_ID, invited_user_id: null } }))
      .mockReturnValueOnce(chain({ data: { host_user_id: "host-1" } })) // jams host lookup
      .mockReturnValueOnce(chain({ data: null })) // no existing row for this user
      .mockReturnValueOnce(chain({ data: null })); // update

    expect(await claimJamInvite(TOKEN, "invitee-1")).toBe(JAM_ID);
    expect(mockAdminFrom.mock.results[3].value.update).toHaveBeenCalledWith({ invited_user_id: "invitee-1" });
  });

  // The host sending the link around shouldn't consume their own invite.
  it("does not claim when the caller hosts the jam", async () => {
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { id: "inv-1", jam_id: JAM_ID, invited_user_id: null } }))
      .mockReturnValueOnce(chain({ data: { host_user_id: "host-1" } }));

    expect(await claimJamInvite(TOKEN, "host-1")).toBe(JAM_ID);
    expect(mockAdminFrom).toHaveBeenCalledTimes(2); // no existence check, no update
  });

  // Reassigning would wipe the original invitee's accept/decline state. Viewing
  // no longer depends on the claim, so leaving it bound costs the visitor nothing.
  it("leaves an invite already bound to someone else alone", async () => {
    mockAdminFrom.mockReturnValueOnce(
      chain({ data: { id: "inv-1", jam_id: JAM_ID, invited_user_id: "someone-else" } })
    );

    expect(await claimJamInvite(TOKEN, "forwarded-to-2")).toBe(JAM_ID);
    expect(mockAdminFrom).toHaveBeenCalledTimes(1);
  });

  // jam_invites has a unique index on (jam_id, invited_user_id).
  it("skips the update when the user already has an invite row for the jam", async () => {
    mockAdminFrom
      .mockReturnValueOnce(chain({ data: { id: "inv-1", jam_id: JAM_ID, invited_user_id: null } }))
      .mockReturnValueOnce(chain({ data: { host_user_id: "host-1" } }))
      .mockReturnValueOnce(chain({ data: { id: "inv-existing" } }));

    expect(await claimJamInvite(TOKEN, "invitee-1")).toBe(JAM_ID);
    expect(mockAdminFrom).toHaveBeenCalledTimes(3); // no update
  });
});
