import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSend, mockBatchSend } = vi.hoisted(() => ({
  mockSend: vi.fn().mockResolvedValue({}),
  mockBatchSend: vi.fn().mockResolvedValue({}),
}));

vi.mock("resend", () => ({
  // A class, not an arrow: lib/resend.ts calls `new Resend(...)`.
  Resend: class {
    emails = { send: mockSend };
    batch = { send: mockBatchSend };
  },
}));

import { resend, REPLY_TO, FROM_ADDRESS } from "./resend";

beforeEach(() => vi.clearAllMocks());

describe("resend client", () => {
  it("sends from SingJam", () => {
    expect(FROM_ADDRESS).toBe("SingJam <hello@singjam.org>");
  });

  it("puts the events inbox on every single send", async () => {
    await resend.emails.send({ from: FROM_ADDRESS, to: "a@b.com", subject: "s", html: "<p/>" } as any);
    expect(mockSend.mock.calls[0][0]).toMatchObject({ replyTo: REPLY_TO });
  });

  it("puts it on every message in a batch", async () => {
    await resend.batch.send([
      { from: FROM_ADDRESS, to: "a@b.com", subject: "1", html: "<p/>" },
      { from: FROM_ADDRESS, to: "c@d.com", subject: "2", html: "<p/>" },
    ] as any);
    for (const m of mockBatchSend.mock.calls[0][0]) {
      expect(m).toMatchObject({ replyTo: REPLY_TO });
    }
  });

  it("lets a caller override it", async () => {
    await resend.emails.send({ from: FROM_ADDRESS, to: "a@b.com", subject: "s", html: "<p/>", replyTo: "someone@else.org" } as any);
    expect(mockSend.mock.calls[0][0].replyTo).toBe("someone@else.org");
  });
});
