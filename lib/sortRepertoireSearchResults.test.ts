import { describe, it, expect } from "vitest";
import { sortRepertoireSearchResults } from "./sortRepertoireSearchResults";

function song(id: string) {
  return { song_id: id };
}

describe("sortRepertoireSearchResults", () => {
  it("puts in-rep songs before non-in-rep songs", () => {
    const results = [song("a"), song("b"), song("c")];
    const rep = new Set(["b"]);
    const sorted = sortRepertoireSearchResults(results, rep);
    expect(sorted[0].song_id).toBe("b");
  });

  it("preserves relative order within each group", () => {
    const results = [song("a"), song("b"), song("c"), song("d")];
    const rep = new Set(["b", "d"]);
    const sorted = sortRepertoireSearchResults(results, rep);
    expect(sorted.map((r) => r.song_id)).toEqual(["b", "d", "a", "c"]);
  });

  it("returns all results when none are in the repertoire", () => {
    const results = [song("a"), song("b"), song("c")];
    const sorted = sortRepertoireSearchResults(results, new Set());
    expect(sorted.map((r) => r.song_id)).toEqual(["a", "b", "c"]);
  });

  it("returns all results when all are in the repertoire", () => {
    const results = [song("a"), song("b"), song("c")];
    const sorted = sortRepertoireSearchResults(results, new Set(["a", "b", "c"]));
    expect(sorted.map((r) => r.song_id)).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the original array", () => {
    const results = [song("a"), song("b")];
    const original = [...results];
    sortRepertoireSearchResults(results, new Set(["b"]));
    expect(results.map((r) => r.song_id)).toEqual(original.map((r) => r.song_id));
  });

  it("handles an empty results array", () => {
    expect(sortRepertoireSearchResults([], new Set(["a"]))).toEqual([]);
  });

  it("works with extra fields on result objects", () => {
    const results = [
      { song_id: "a", title: "Alpha", score: 0.9 },
      { song_id: "b", title: "Beta", score: 0.8 },
    ];
    const sorted = sortRepertoireSearchResults(results, new Set(["b"]));
    expect(sorted[0]).toMatchObject({ song_id: "b", title: "Beta" });
    expect(sorted[1]).toMatchObject({ song_id: "a", title: "Alpha" });
  });
});
