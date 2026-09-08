import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/stripe", () => ({ SITE_URL: "https://singjam.org" }));
vi.mock("@/lib/resend", () => ({
  resend: { emails: { send: vi.fn().mockResolvedValue({ error: null }) } },
  FROM_ADDRESS: "SingJam <hello@singjam.org>",
}));
vi.mock("@/lib/ticketFulfilment", () => ({ sendTicketEmail: vi.fn() }));

import { sweepUndeliveredTickets, expireStaleTicketHolds } from "./ticketSweep";
import { sendTicketEmail } from "@/lib/ticketFulfilment";
import { resend } from "@/lib/resend";

// Chainable Supabase mock addressed by TABLE, never by call order: the sweep
// touches ticket_orders, jams and system_flags in a sequence that changes with
// every branch, and positional mocks broke on every edit.
function makeAdmin({
  queue = [] as any[],
  queueError = null as any,
  jams = [] as any[],
  flag = null as any,
  rpcData = 0 as any,
  rpcError = null as any,
} = {}) {
  const updates: { table: string; payload: any; id?: string }[] = [];
  const upserts: { table: string; payload: any }[] = [];

  const from = vi.fn((table: string) => {
    let mode: "select" | "update" | "upsert" = "select";
    let payload: any = null;
    let id: string | undefined;
    const obj: any = {};
    const pass = () => vi.fn(() => obj);
    obj.select = pass();
    obj.order = pass();
    obj.limit = pass();
    obj.is = pass();
    obj.in = pass();
    obj.maybeSingle = pass();
    obj.eq = vi.fn((col: string, val: any) => {
      if (col === "id") id = val;
      return obj;
    });
    obj.update = vi.fn((p: any) => { mode = "update"; payload = p; return obj; });
    obj.upsert = vi.fn((p: any) => { mode = "upsert"; payload = p; return obj; });
    obj.then = (resolve: any) => {
      if (mode === "update") { updates.push({ table, payload, id }); return resolve({ data: null, error: null }); }
      if (mode === "upsert") { upserts.push({ table, payload }); return resolve({ data: null, error: null }); }
      if (table === "ticket_orders") return resolve({ data: queue, error: queueError });
      if (table === "jams") return resolve({ data: jams, error: null });
      if (table === "system_flags") return resolve({ data: flag, error: null });
      return resolve({ data: null, error: null });
    };
    return obj;
  });

  const rpc = vi.fn(async () => ({ data: rpcData, error: rpcError }));
  return { admin: { from, rpc } as any, updates, upserts, rpc };
}

const order = (over: Partial<any> = {}) => ({
  id: "o1",
  jam_id: "j1",
  buyer_user_id: null,
  buyer_email: "buyer@example.com",
  buyer_name: "Buyer",
  amount_cents: 1500,
  currency: "usd",
  paid_at: "2026-09-07T20:00:00Z",
  ...over,
});

const sent = () => (resend.emails.send as any).mock.calls;

beforeEach(() => {
  vi.mocked(sendTicketEmail).mockReset();
  (resend.emails.send as any).mockReset();
  (resend.emails.send as any).mockResolvedValue({ error: null });
});

describe("sweepUndeliveredTickets", () => {
  it("does nothing when no paid order is missing its ticket", async () => {
    const { admin, updates } = makeAdmin({ queue: [] });
    expect(await sweepUndeliveredTickets(admin)).toEqual({ pending: 0, delivered: 0, failed: 0, alerted: false });
    expect(sendTicketEmail).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
    expect(sent()).toHaveLength(0);
  });

  it("retries the send and stamps the order when it succeeds", async () => {
    vi.mocked(sendTicketEmail).mockResolvedValue(true);
    const { admin, updates } = makeAdmin({ queue: [order()], jams: [{ id: "j1", name: "Tuesday Jam" }] });

    const result = await sweepUndeliveredTickets(admin);

    expect(result).toMatchObject({ pending: 1, delivered: 1, failed: 0, alerted: false });
    expect(updates).toHaveLength(1);
    expect(updates[0].table).toBe("ticket_orders");
    expect(updates[0].id).toBe("o1");
    expect(updates[0].payload.ticket_email_sent_at).toBeTruthy();
    // A recovered order is not an emergency — nobody gets woken up.
    expect(sent()).toHaveLength(0);
  });

  it("alerts a human, and does not stamp, when the retry fails too", async () => {
    vi.mocked(sendTicketEmail).mockRejectedValue(new Error("Resend 503"));
    const { admin, updates, upserts } = makeAdmin({ queue: [order()], jams: [{ id: "j1", name: "Tuesday Jam" }] });

    const result = await sweepUndeliveredTickets(admin);

    expect(result).toMatchObject({ pending: 1, delivered: 0, failed: 1, alerted: true });
    // Not stamping is what keeps it in the queue for the next sweep.
    expect(updates).toHaveLength(0);

    expect(sent()).toHaveLength(1);
    const mail = sent()[0][0];
    expect(mail.to).toBe("events@singjam.org");
    expect(mail.subject).toContain("1 paid ticket");
    expect(mail.html).toContain("Tuesday Jam");
    expect(mail.html).toContain("buyer@example.com");
    expect(mail.html).toContain("Resend 503");
    expect(mail.html).toContain("$15.00");
    expect(mail.html).toContain("o1");
    // Paid time in the event's timezone, not a UTC stamp to decode.
    expect(mail.html).toContain("Sep 7, 2026, 1:00 PM");

    // The flag records which orders were named so the next sweep can tell a
    // repeat from new money at risk.
    expect(upserts).toHaveLength(1);
    expect(upserts[0].table).toBe("system_flags");
    expect(JSON.parse(upserts[0].payload.value).ids).toEqual(["o1"]);
  });

  it("shows the paid time in the event's own timezone", async () => {
    vi.mocked(sendTicketEmail).mockRejectedValue(new Error("down"));
    const { admin } = makeAdmin({
      queue: [order()],
      jams: [{ id: "j1", name: "Tuesday Jam", timezone: "America/New_York" }],
    });

    await sweepUndeliveredTickets(admin);
    expect(sent()[0][0].html).toContain("Sep 7, 2026, 4:00 PM");
  });

  it("reports an order with no address anywhere rather than marking it delivered", async () => {
    vi.mocked(sendTicketEmail).mockResolvedValue(false);
    const { admin, updates } = makeAdmin({
      queue: [order({ buyer_email: null, buyer_user_id: "u1" })],
      jams: [{ id: "j1", name: "Tuesday Jam" }],
    });

    const result = await sweepUndeliveredTickets(admin);

    expect(result).toMatchObject({ delivered: 0, failed: 1, alerted: true });
    expect(updates).toHaveLength(0);
    expect(sent()[0][0].html).toContain("No email address");
  });

  it("stays quiet about orders the last alert already named", async () => {
    vi.mocked(sendTicketEmail).mockRejectedValue(new Error("still down"));
    const { admin } = makeAdmin({
      queue: [order()],
      jams: [{ id: "j1", name: "Tuesday Jam" }],
      flag: { value: JSON.stringify({ at: new Date().toISOString(), ids: ["o1"] }) },
    });

    const result = await sweepUndeliveredTickets(admin);

    expect(result).toMatchObject({ failed: 1, alerted: false });
    expect(sent()).toHaveLength(0);
  });

  it("alerts immediately for a new order even inside the cooldown", async () => {
    vi.mocked(sendTicketEmail).mockRejectedValue(new Error("still down"));
    const { admin } = makeAdmin({
      queue: [order({ id: "o1" }), order({ id: "o2" })],
      jams: [{ id: "j1", name: "Tuesday Jam" }],
      flag: { value: JSON.stringify({ at: new Date().toISOString(), ids: ["o1"] }) },
    });

    const result = await sweepUndeliveredTickets(admin);

    expect(result).toMatchObject({ failed: 2, alerted: true });
    expect(sent()[0][0].subject).toContain("2 paid tickets");
  });

  it("re-alerts about the same order once the cooldown has elapsed", async () => {
    vi.mocked(sendTicketEmail).mockRejectedValue(new Error("still down"));
    const sevenHoursAgo = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString();
    const { admin } = makeAdmin({
      queue: [order()],
      jams: [{ id: "j1", name: "Tuesday Jam" }],
      flag: { value: JSON.stringify({ at: sevenHoursAgo, ids: ["o1"] }) },
    });

    expect(await sweepUndeliveredTickets(admin)).toMatchObject({ alerted: true });
  });

  it("treats an unreadable flag as never having alerted", async () => {
    vi.mocked(sendTicketEmail).mockRejectedValue(new Error("still down"));
    const { admin } = makeAdmin({
      queue: [order()],
      jams: [{ id: "j1", name: "Tuesday Jam" }],
      flag: { value: "not json" },
    });

    expect(await sweepUndeliveredTickets(admin)).toMatchObject({ alerted: true });
  });

  it("keeps delivering the rest of the batch when one order fails", async () => {
    vi.mocked(sendTicketEmail)
      .mockRejectedValueOnce(new Error("bad address"))
      .mockResolvedValueOnce(true);
    const { admin, updates } = makeAdmin({
      queue: [order({ id: "o1" }), order({ id: "o2" })],
      jams: [{ id: "j1", name: "Tuesday Jam" }],
    });

    const result = await sweepUndeliveredTickets(admin);

    expect(result).toMatchObject({ pending: 2, delivered: 1, failed: 1 });
    expect(updates.map((u) => u.id)).toEqual(["o2"]);
  });

  it("gives up quietly if the queue itself cannot be read", async () => {
    const { admin } = makeAdmin({ queueError: { message: "boom" } });
    expect(await sweepUndeliveredTickets(admin)).toEqual({ pending: 0, delivered: 0, failed: 0, alerted: false });
    expect(sendTicketEmail).not.toHaveBeenCalled();
  });

  it("survives the alert itself failing, without losing the retry queue", async () => {
    vi.mocked(sendTicketEmail).mockRejectedValue(new Error("down"));
    (resend.emails.send as any).mockRejectedValue(new Error("alert down"));
    const { admin, updates } = makeAdmin({ queue: [order()], jams: [{ id: "j1", name: "Tuesday Jam" }] });

    expect(await sweepUndeliveredTickets(admin)).toMatchObject({ failed: 1, alerted: false });
    expect(updates).toHaveLength(0);
  });
});

describe("expireStaleTicketHolds", () => {
  it("returns how many holds it released", async () => {
    const { admin, rpc } = makeAdmin({ rpcData: 3 });
    expect(await expireStaleTicketHolds(admin)).toBe(3);
    expect(rpc).toHaveBeenCalledWith("expire_stale_ticket_orders");
  });

  it("returns 0 when the function errors", async () => {
    const { admin } = makeAdmin({ rpcError: { message: "nope" } });
    expect(await expireStaleTicketHolds(admin)).toBe(0);
  });
});
