import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockEmailSend, mockFrom, mockGetUserById } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockEmailSend: vi.fn().mockResolvedValue({ id: "email-id" }),
  mockFrom: vi.fn(),
  mockGetUserById: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
  }),
}));

vi.mock("@/lib/resend", () => ({
  resend: { emails: { send: mockEmailSend } },
  FROM_ADDRESS: "SingJam <hello@singjam.org>",
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
    auth: { admin: { getUserById: mockGetUserById } },
  })),
}));

import { POST } from "./route";

function makeRequest(body: object) {
  return new Request("http://localhost/api/jam/test-jam-id/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const params = Promise.resolve({ id: "test-jam-id" });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/jam/[id]/message", () => {
  it("returns 401 when the user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(makeRequest({ subject: "Hey", message: "Hi" }), { params });
    expect(res.status).toBe(401);
  });

  it("returns 403 when the authenticated user is not the host or a co-host", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "visitor-id" } } });
    mockFrom.mockImplementation((table: string) => {
      if (table === "jams") return jamRow("host-id");
      if (table === "jam_cohosts") return cohostLookup(null);
      return emptyTable();
    });

    const res = await POST(makeRequest({ subject: "Hey", message: "Hi" }), { params });
    expect(res.status).toBe(403);
  });

  it("allows a co-host (not the host) to message attendees", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "cohost-id" } } });
    mockFrom.mockImplementation((table: string) => {
      if (table === "jams") return jamRow("host-id");
      if (table === "jam_cohosts") return cohostLookup({ user_id: "cohost-id" });
      if (table === "profiles") return profileRow("Cohost");
      if (table === "jam_rsvps") return rsvpRows([]);
      return emptyTable();
    });

    const res = await POST(makeRequest({ subject: "Hey", message: "Hi" }), { params });
    expect(res.status).toBe(200);
  });

  it("returns 400 when subject is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "host-id" } } });

    const res = await POST(makeRequest({ subject: "", message: "Hi" }), { params });
    expect(res.status).toBe(400);
  });

  it("returns 400 when message is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "host-id" } } });

    const res = await POST(makeRequest({ subject: "Hey", message: "" }), { params });
    expect(res.status).toBe(400);
  });

  it("sends to attending RSVPs when audience is 'attending'", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "host-id" } } });

    mockFrom.mockImplementation((table: string) => {
      if (table === "jams") return jamRow("host-id");
      if (table === "profiles") return profileRow("Alice");
      if (table === "jam_rsvps") return rsvpRows([{ user_id: "attendee-1" }]);
      return emptyTable();
    });
    mockGetUserById.mockResolvedValue({ data: { user: { email: "alice@example.com" } } });

    const res = await POST(makeRequest({ subject: "Hey", message: "Hi", audience: "attending" }), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sent).toBe(1);
    expect(mockEmailSend).toHaveBeenCalledTimes(1);
  });

  it("excludes the host from the recipient list", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "host-id" } } });

    mockFrom.mockImplementation((table: string) => {
      if (table === "jams") return jamRow("host-id");
      if (table === "profiles") return profileRow("Ben");
      if (table === "jam_rsvps") return rsvpRows([{ user_id: "host-id" }]);
      return emptyTable();
    });

    const res = await POST(makeRequest({ subject: "Hey", message: "Reminder" }), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sent).toBe(0);
    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it("includes pending invitees when audience is 'all_invited'", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "host-id" } } });

    mockFrom.mockImplementation((table: string) => {
      if (table === "jams") return jamRow("host-id");
      if (table === "profiles") return profileRow("Alice");
      if (table === "jam_rsvps") return rsvpRows([{ user_id: "attendee-1" }]);
      if (table === "jam_invites") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                data: [
                  { invited_user_id: "invitee-member", invitee_email: null },
                  { invited_user_id: null, invitee_email: "nonmember@example.com" },
                ],
              }),
            }),
          }),
        };
      }
      return emptyTable();
    });

    mockGetUserById.mockImplementation((userId: string) => ({
      data: { user: { email: `${userId}@example.com` } },
    }));

    const res = await POST(makeRequest({ subject: "Hey", message: "Hi", audience: "all_invited" }), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    // attendee-1 + invitee-member + nonmember@example.com = 3
    expect(body.sent).toBe(3);
    expect(mockEmailSend).toHaveBeenCalledTimes(3);
  });

  it("deduplicates when an invitee is also an attending RSVP", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "host-id" } } });

    // Same email returned for both the RSVP user and the invite user
    mockGetUserById.mockResolvedValue({ data: { user: { email: "shared@example.com" } } });

    mockFrom.mockImplementation((table: string) => {
      if (table === "jams") return jamRow("host-id");
      if (table === "profiles") return profileRow("Alice");
      if (table === "jam_rsvps") return rsvpRows([{ user_id: "user-1" }]);
      if (table === "jam_invites") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ data: [{ invited_user_id: "user-1", invitee_email: null }] }),
            }),
          }),
        };
      }
      return emptyTable();
    });

    const res = await POST(makeRequest({ subject: "Hey", message: "Hi", audience: "all_invited" }), { params });
    const body = await res.json();

    expect(body.sent).toBe(1);
    expect(mockEmailSend).toHaveBeenCalledTimes(1);
  });
});

// ── helpers ───────────────────────────────────────────────────────────────────

function jamRow(hostId: string) {
  return {
    select: () => ({ eq: () => ({ single: () => ({ data: { host_user_id: hostId, name: "Test Jam" } }) }) }),
  };
}

function profileRow(name: string) {
  return {
    select: () => ({ eq: () => ({ single: () => ({ data: { display_name: name, username: null } }) }) }),
  };
}

function rsvpRows(rows: { user_id: string }[]) {
  return {
    select: () => ({ eq: () => ({ eq: () => ({ data: rows }) }) }),
  };
}

function emptyTable() {
  return { select: () => ({ eq: () => ({ eq: () => ({ data: [] }) }) }) };
}

function cohostLookup(data: { user_id: string } | null) {
  return {
    select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => ({ data }) }) }) }),
  };
}
