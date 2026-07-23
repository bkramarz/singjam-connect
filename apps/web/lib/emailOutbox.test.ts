import { describe, it, expect, vi } from "vitest";

vi.mock("@/emails/welcome", () => ({ welcomeEmailHtml: () => "<html></html>" }));

import { enqueueWelcomeEmail, flushEmailOutbox } from "./emailOutbox";

// Minimal chainable Supabase mock. A fresh builder per from() call resolves to
// `upsertResult` when .upsert() was used, `selectResult` otherwise, and records
// every .update() payload so we can assert status transitions.
function makeAdmin({
  upsertResult = { data: [], error: null } as any,
  selectResult = { data: [], error: null } as any,
} = {}) {
  const updates: any[] = [];
  const from = vi.fn(() => {
    let usedUpsert = false;
    let updatePayload: any = null;
    const obj: any = {};
    const pass = (fn?: (...a: any[]) => void) => vi.fn((...args: any[]) => { fn?.(...args); return obj; });
    obj.upsert = pass(() => { usedUpsert = true; });
    obj.select = pass();
    obj.eq = pass();
    obj.lt = pass();
    obj.order = pass();
    obj.limit = pass();
    obj.update = vi.fn((payload: any) => { updatePayload = payload; updates.push(payload); return obj; });
    obj.then = (resolve: any) =>
      resolve(updatePayload !== null ? { data: null, error: null } : usedUpsert ? upsertResult : selectResult);
    return obj;
  });
  return { admin: { from } as any, updates };
}

const okResend = () => ({ emails: { send: vi.fn().mockResolvedValue({ error: null }) } }) as any;
const errResend = (message = "boom") => ({ emails: { send: vi.fn().mockResolvedValue({ error: { message } }) } }) as any;

const row = (over: Partial<any> = {}) => ({
  id: "e1", type: "welcome", recipient: "a@b.com", payload: { username: "u" }, attempts: 0, ...over,
});

describe("enqueueWelcomeEmail", () => {
  it("inserts, sends immediately, and marks the row sent", async () => {
    const { admin, updates } = makeAdmin({ upsertResult: { data: [row()], error: null } });
    const resend = okResend();
    await enqueueWelcomeEmail(admin, resend, { userId: "u1", email: "a@b.com", username: "u" });
    expect(resend.emails.send).toHaveBeenCalledOnce();
    expect(updates.at(-1)).toMatchObject({ status: "sent", attempts: 1 });
  });

  it("is a no-op when the row already exists (unique conflict → empty insert)", async () => {
    const { admin, updates } = makeAdmin({ upsertResult: { data: [], error: null } });
    const resend = okResend();
    await enqueueWelcomeEmail(admin, resend, { userId: "u1", email: "a@b.com" });
    expect(resend.emails.send).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it("leaves the row pending with the error recorded when the send fails", async () => {
    const { admin, updates } = makeAdmin({ upsertResult: { data: [row()], error: null } });
    await enqueueWelcomeEmail(admin, errResend("smtp down"), { userId: "u1", email: "a@b.com" });
    expect(updates.at(-1)).toMatchObject({ status: "pending", attempts: 1, last_error: "smtp down" });
  });
});

describe("flushEmailOutbox", () => {
  it("sends every pending row and reports counts", async () => {
    const { admin } = makeAdmin({
      selectResult: { data: [row({ id: "e1" }), row({ id: "e2", attempts: 2 })], error: null },
    });
    const resend = okResend();
    const res = await flushEmailOutbox(admin, resend);
    expect(res).toEqual({ sent: 2, failed: 0 });
    expect(resend.emails.send).toHaveBeenCalledTimes(2);
  });

  it("marks a row failed once it hits the attempt cap", async () => {
    const { admin, updates } = makeAdmin({ selectResult: { data: [row({ attempts: 4 })], error: null } });
    const res = await flushEmailOutbox(admin, errResend());
    expect(res).toEqual({ sent: 0, failed: 1 });
    expect(updates.at(-1)).toMatchObject({ status: "failed", attempts: 5 });
  });
});
