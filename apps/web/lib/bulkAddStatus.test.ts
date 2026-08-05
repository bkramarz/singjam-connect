import { describe, it, expect } from "vitest";
import { bulkAddStatus } from "./bulkAddStatus";

describe("bulkAddStatus", () => {
  it("confirms success", () => {
    expect(bulkAddStatus("Sunday Set", { ok: true, status: 200 })).toEqual({
      text: "Added to Sunday Set",
      ok: true,
    });
  });

  it("does not claim success when the request was rejected", () => {
    // The whole selection now lands or doesn't, so a false "Added" would claim
    // every song made it when none did.
    expect(bulkAddStatus("Sunday Set", { ok: false, status: 500 })).toEqual({
      text: "Couldn't add to Sunday Set",
      ok: false,
    });
  });

  it("does not claim success when the request never completed", () => {
    expect(bulkAddStatus("Sunday Set", null)).toEqual({
      text: "Couldn't add to Sunday Set",
      ok: false,
    });
  });

  it("names loss of access separately from a generic failure", () => {
    expect(bulkAddStatus("Sunday Set", { ok: false, status: 403 })).toEqual({
      text: "No longer have access to Sunday Set",
      ok: false,
    });
  });

  it("never reports ok for any non-2xx outcome", () => {
    for (const status of [400, 401, 403, 404, 409, 500, 502]) {
      expect(bulkAddStatus("S", { ok: false, status }).ok).toBe(false);
    }
  });

  it("falls back to a generic name when the set is unknown", () => {
    expect(bulkAddStatus("set", { ok: true, status: 200 }).text).toBe("Added to set");
  });
});
