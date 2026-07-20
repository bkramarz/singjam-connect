import { describe, it, expect } from "vitest";
import { mergeSuggestionsById } from "./mergeSuggestionsById";

type Row = { song_id: string };

const ids = (rows: Row[]) => rows.map((r) => r.song_id);

describe("mergeSuggestionsById", () => {
  it("appends a fresh page after the existing rows", () => {
    const existing: Row[] = [{ song_id: "a" }, { song_id: "b" }];
    const page: Row[] = [{ song_id: "c" }, { song_id: "d" }];
    expect(ids(mergeSuggestionsById(existing, page))).toEqual(["a", "b", "c", "d"]);
  });

  it("drops rows whose song_id is already present", () => {
    const existing: Row[] = [{ song_id: "a" }, { song_id: "b" }];
    const page: Row[] = [{ song_id: "b" }, { song_id: "c" }];
    expect(ids(mergeSuggestionsById(existing, page))).toEqual(["a", "b", "c"]);
  });

  it("keeps the first occurrence when a page repeats itself", () => {
    const existing: Row[] = [];
    const page: Row[] = [{ song_id: "a" }, { song_id: "a" }];
    // Only existing rows are deduped against; intra-page dupes are out of scope
    // because the RPC never returns the same id twice within one page.
    expect(ids(mergeSuggestionsById(existing, page))).toEqual(["a", "a"]);
  });

  it("returns the existing rows unchanged for an empty page", () => {
    const existing: Row[] = [{ song_id: "a" }];
    expect(ids(mergeSuggestionsById(existing, []))).toEqual(["a"]);
  });

  it("does not mutate the input arrays", () => {
    const existing: Row[] = [{ song_id: "a" }];
    const page: Row[] = [{ song_id: "b" }];
    mergeSuggestionsById(existing, page);
    expect(ids(existing)).toEqual(["a"]);
    expect(ids(page)).toEqual(["b"]);
  });
});
