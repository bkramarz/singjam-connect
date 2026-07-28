import { describe, it, expect, vi } from "vitest";
import { fetchAllRows } from "./fetchAllRows";

const table = (count: number) => Array.from({ length: count }, (_, i) => ({ id: i }));

const pager = (rows: { id: number }[]) =>
  vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }));

describe("fetchAllRows", () => {
  it("returns every row when the table spans multiple pages", async () => {
    const page = pager(table(2500));
    const rows = await fetchAllRows(page, 1000);
    expect(rows).toHaveLength(2500);
    expect(page.mock.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("stops after one request when the table fits in a single page", async () => {
    const page = pager(table(42));
    expect(await fetchAllRows(page, 1000)).toHaveLength(42);
    expect(page).toHaveBeenCalledTimes(1);
  });

  it("makes one extra request when the row count is an exact multiple of the page size", async () => {
    const page = pager(table(2000));
    expect(await fetchAllRows(page, 1000)).toHaveLength(2000);
    expect(page).toHaveBeenCalledTimes(3);
  });

  it("returns an empty array for an empty table", async () => {
    expect(await fetchAllRows(pager([]), 1000)).toEqual([]);
  });

  it("treats a null data payload as the end of the table", async () => {
    const page = vi.fn(async () => ({ data: null, error: null }));
    expect(await fetchAllRows(page, 1000)).toEqual([]);
  });

  it("throws whatever error a page returns instead of silently truncating", async () => {
    const page = vi.fn(async (from: number) =>
      from === 0
        ? { data: table(1000), error: null }
        : { data: null, error: new Error("range not satisfiable") }
    );
    await expect(fetchAllRows(page, 1000)).rejects.toThrow("range not satisfiable");
  });
});
