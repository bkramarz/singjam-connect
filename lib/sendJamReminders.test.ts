import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendJamReminders } from "./sendJamReminders";

function makeAdmin({
  jams = [] as any[],
  rsvps = [] as any[],
  invites = [] as any[],
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
      if (table === "jam_invites") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ data: invites }),
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

const BASE_JAM = {
  id: "jam-1",
  name: "Friday Jam",
  starts_at: "2026-06-10T19:00:00Z",
  timezone: "America/New_York",
  full_address: "123 Main St",
  neighborhood: null,
  host_user_id: "host-1",
};

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

  it("always sends to the host even with no RSVPs or pending invites", async () => {
    const admin = makeAdmin({ jams: [BASE_JAM] });
    const resend = makeResend();

    const sent = await sendJamReminders(admin, resend);

    expect(sent).toBe(1);
    expect(resend.emails.send).toHaveBeenCalledTimes(1);
  });

  it("sends to attending RSVPs and the host", async () => {
    const rsvps = [{ user_id: "user-1" }, { user_id: "user-2" }];
    const admin = makeAdmin({ jams: [BASE_JAM], rsvps });
    const resend = makeResend();

    const sent = await sendJamReminders(admin, resend);

    // host-1 + user-1 + user-2
    expect(sent).toBe(3);
    expect(resend.emails.send).toHaveBeenCalledTimes(3);
  });

  it("sends to pending invitees in addition to attending RSVPs and the host", async () => {
    const rsvps = [{ user_id: "user-1" }];
    const invites = [{ invited_user_id: "user-2" }, { invited_user_id: "user-3" }];
    const admin = makeAdmin({ jams: [BASE_JAM], rsvps, invites });
    const resend = makeResend();

    const sent = await sendJamReminders(admin, resend);

    // host-1 + user-1 + user-2 + user-3
    expect(sent).toBe(4);
    expect(resend.emails.send).toHaveBeenCalledTimes(4);
  });

  it("deduplicates when the host also has an attending RSVP", async () => {
    const rsvps = [{ user_id: "host-1" }, { user_id: "user-1" }];
    const admin = makeAdmin({ jams: [BASE_JAM], rsvps });
    const resend = makeResend();

    const sent = await sendJamReminders(admin, resend);

    // host-1 (deduped) + user-1
    expect(sent).toBe(2);
    expect(resend.emails.send).toHaveBeenCalledTimes(2);
  });

  it("deduplicates when a pending invitee also has an attending RSVP", async () => {
    const rsvps = [{ user_id: "user-1" }];
    const invites = [{ invited_user_id: "user-1" }];
    const admin = makeAdmin({ jams: [BASE_JAM], rsvps, invites });
    const resend = makeResend();

    const sent = await sendJamReminders(admin, resend);

    // host-1 + user-1 (deduped)
    expect(sent).toBe(2);
    expect(resend.emails.send).toHaveBeenCalledTimes(2);
  });

  it("records the reminder in jam_reminders_sent before emailing", async () => {
    const rsvps = [{ user_id: "user-1" }];
    const admin = makeAdmin({
      jams: [{ ...BASE_JAM, full_address: null, neighborhood: "Brooklyn" }],
      rsvps,
    });
    const resend = makeResend();

    await sendJamReminders(admin, resend);

    expect(admin._mockInsert).toHaveBeenCalledWith({ jam_id: "jam-1", reminder_type: "24h" });
    expect(admin._mockInsert.mock.invocationCallOrder[0]).toBeLessThan(
      (resend.emails.send as any).mock.invocationCallOrder[0]
    );
  });

  it("records the reminder even when only the host is a recipient", async () => {
    const admin = makeAdmin({ jams: [BASE_JAM] });
    const resend = makeResend();

    await sendJamReminders(admin, resend);

    expect(admin._mockInsert).toHaveBeenCalledWith({ jam_id: "jam-1", reminder_type: "24h" });
  });

  it("uses neighborhood as fallback when full_address is null", async () => {
    const jams = [{ ...BASE_JAM, full_address: null, neighborhood: "Park Slope" }];
    const rsvps = [{ user_id: "user-1" }];
    const admin = makeAdmin({ jams, rsvps });
    const resend = makeResend();

    await sendJamReminders(admin, resend);

    const htmlValues = (resend.emails.send.mock.calls as any[]).map((c: any) => c[0].html);
    expect(htmlValues.every((html: string) => html.includes("Park Slope"))).toBe(true);
  });

  it("includes the day name in the subject", async () => {
    // starts_at is a Wednesday in UTC
    const jams = [{ ...BASE_JAM, starts_at: "2026-06-10T19:00:00Z", timezone: "America/New_York" }];
    const admin = makeAdmin({ jams });
    const resend = makeResend();

    await sendJamReminders(admin, resend);

    const subject = resend.emails.send.mock.calls[0][0].subject as string;
    expect(subject).toMatch(/is tomorrow \(Wednesday\)/);
  });

  it("omits the day name when starts_at is null", async () => {
    const jams = [{ ...BASE_JAM, starts_at: null }];
    const admin = makeAdmin({ jams });
    const resend = makeResend();

    await sendJamReminders(admin, resend);

    const subject = resend.emails.send.mock.calls[0][0].subject as string;
    expect(subject).toMatch(/is tomorrow$/);
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
