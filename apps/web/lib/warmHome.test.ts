import { describe, expect, it, vi } from "vitest";
import { warmHome } from "./warmHome";

describe("warmHome", () => {
  it("fetches the home page with the warmer user-agent", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    await warmHome(fetchFn as any);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toMatch(/\/$/);
    expect(init.headers["user-agent"]).toBe("singjam-cache-warmer");
  });

  it("throws when the response is not ok", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(warmHome(fetchFn as any)).rejects.toThrow("503");
  });
});
