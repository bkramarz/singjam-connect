import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendJamReminders } from "./sendJamReminders";

function makeAdmin({
  jams = [] as any[],
  rsvps = [] as any[],
  profile = { display_name: "Alice", username: null },
  insertError = null as any,
} = {}) {
  const mockInsert = vi.fn().mockResolvedValue({ error: insertError });

  const admin = {
    from: vi.fn((table: string) => {
      if (table === "jams") {
        return {
          select: () => ({
            gte: () => ({
              lte: () => ({
                not: () => ({ data: jams, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "jam_rsvps") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ data: rsvps }),
            }),
          }),
        };
      }
      if (table === "jam_reminders_sent") {
        return { insert: mockInsert };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({ data: profile }),
            }),
          }),
        };
      }
      return {};
    }),
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue({ data: { user: { email: "alice@example.com" } } }),
      },
    },
    _mockInsert: mockInsert,
  };

  return admin as any;
}

function makeResend() {
  return { emails: { send: vi.fn().mockResolvedValue({ id: "email-id" }) } } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sendJamReminders", () => {
  it("returns 0 and sends nothing when no jams are in the window", async () => {
    const admin = makeAdmin({ jams: [] });
    const resend = makeResend();

    const sent = await sendJamReminders(admin, resend);

    expect(sent).toBe(0);
    expect(resend.emails.send).not.toHaveBeenCalled();
  });

  it("sends a reminder to each attending RSVP", async () => {
    const jams = [{ id: "jam-1", name: "Friday Jam", starts_at: "2026-06-10T19:00:00Z", timezone: "America/New_York", full_address: "123 Main St", neighborhood: null }];
    const rsvps = [{ user_id: "user-1" }, { user_id: "user-2" }];
    const admin = makeAdmin({ jams, rsvps });
    const resend = makeResend();

    const sent = await sendJamReminders(admin, resend);

    expect(sent).toBe(2);
    expect(resend.emails.send).toHaveBeenCalledTimes(2);
  });

  it("records the reminder in jam_reminders_sent before emailing", async () => {
    const jams = [{ id: "jam-1", name: "Friday Jam", starts_at: "2026-06-10T19:00:00Z", timezone: null, full_address: null, neighborhood: "Brooklyn" }];
    const rsvps = [{ user_id: "user-1" }];
    const admin = makeAdmin({ jams, rsvps });
    const resend = makeResend();

    await sendJamReminders(admin, resend);

    // Insert should have been called before emails went out
    expect(admin._mockInsert).toHaveBeenCalledWith({ jam_id: "jam-1", reminder_type: "24h" });
    expect(admin._mockInsert.mock.invocationCallOrder[0]).toBeLessThan(
      (resend.emails.send as any).mock.invocationCallOrder[0]
    );
  });

  it("still records the reminder when there are no RSVPs (so it doesn't re-check)", async () => {
    const jams = [{ id: "jam-1", name: "Empty Jam", starts_at: "2026-06-10T19:00:00Z", timezone: null, full_address: null, neighborhood: null }];
    const admin = makeAdmin({ jams, rsvps: [] });
    const resend = makeResend();

    const sent = await sendJamReminders(admin, resend);

    expect(sent).toBe(0);
    expect(admin._mockInsert).toHaveBeenCalledWith({ jam_id: "jam-1", reminder_type: "24h" });
    expect(resend.emails.send).not.toHaveBeenCalled();
  });

  it("uses neighborhood as fallback when full_address is null", async () => {
    const jams = [{ id: "jam-1", name: "Friday Jam", starts_at: "2026-06-10T19:00:00Z", timezone: null, full_address: null, neighborhood: "Park Slope" }];
    const rsvps = [{ user_id: "user-1" }];
    const admin = makeAdmin({ jams, rsvps });
    const resend = makeResend();

    await sendJamReminders(admin, resend);

    const callArg = resend.emails.send.mock.calls[0][0];
    expect(callArg.html).toContain("Park Slope");
  });

  it("throws when the jams query fails", async () => {
    const admin = {
      from: vi.fn(() => ({
        select: () => ({
          gte: () => ({
            lte: () => ({
              not: () => ({ data: null, error: new Error("DB error") }),
            }),
          }),
        }),
      })),
      auth: { admin: { getUserById: vi.fn() } },
    } as any;

    await expect(sendJamReminders(admin, makeResend())).rejects.toThrow("DB error");
  });
});
