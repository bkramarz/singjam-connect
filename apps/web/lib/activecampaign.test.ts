import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("@/lib/resend", () => ({ resend: { emails: { send: vi.fn() } }, FROM_ADDRESS: "SingJam <hello@singjam.org>" }));

// activecampaign.ts reads AC_API_URL/AC_API_KEY into module-level consts at import
// time, so env vars must be stubbed before the (dynamic) import happens.
let deleteContact: typeof import("./activecampaign").deleteContact;

beforeAll(async () => {
  vi.stubEnv("AC_API_URL", "https://example.activehosted.com");
  vi.stubEnv("AC_API_KEY", "test-key");
  ({ deleteContact } = await import("./activecampaign"));
});

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, text: async () => JSON.stringify(body) };
}

function emptyResponse(ok = true, status = 200) {
  return { ok, status, text: async () => "" };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("deleteContact", () => {
  it("looks up the contact by email and deletes it", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ contacts: [{ id: "42" }] }))
      .mockResolvedValueOnce(emptyResponse());

    const result = await deleteContact("singer@example.com");

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "https://example.activehosted.com/api/3/contacts?email=singer%40example.com",
      expect.objectContaining({ method: "GET" })
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://example.activehosted.com/api/3/contacts/42",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("treats a missing contact as already deleted, without calling DELETE", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ contacts: [] }));

    const result = await deleteContact("nobody@example.com");

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns false when the delete call fails", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ contacts: [{ id: "42" }] }))
      .mockResolvedValueOnce(jsonResponse({ error: "boom" }, false, 500));

    const result = await deleteContact("singer@example.com");

    expect(result).toBe(false);
  });
});
