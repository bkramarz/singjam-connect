import { describe, it, expect } from "vitest";
import { reorderSongsForPlayed } from "./reorderSongsForPlayed";

type Row = { id: string; played?: boolean | null };

const ids = (rows: Row[]) => rows.map((r) => r.id);

describe("reorderSongsForPlayed", () => {
  it("moves a newly played song to just after the already-played songs", () => {
    const songs: Row[] = [
      { id: "a", played: true },
      { id: "b", played: false },
      { id: "c", played: false },
    ];
    const result = reorderSongsForPlayed(songs, "c", true);
    expect(ids(result)).toEqual(["a", "c", "b"]);
    expect(result.find((r) => r.id === "c")!.played).toBe(true);
  });

  it("places the first played song at the very top", () => {
    const songs: Row[] = [
      { id: "a", played: false },
      { id: "b", played: false },
    ];
    expect(ids(reorderSongsForPlayed(songs, "b", true))).toEqual(["b", "a"]);
  });

  it("moves an un-played song to sit first among the unplayed", () => {
    const songs: Row[] = [
      { id: "a", played: true },
      { id: "b", played: true },
      { id: "c", played: false },
    ];
    const result = reorderSongsForPlayed(songs, "b", false);
    expect(ids(result)).toEqual(["a", "b", "c"]);
    expect(result.find((r) => r.id === "b")!.played).toBe(false);
  });

  it("does not mutate the input array", () => {
    const songs: Row[] = [
      { id: "a", played: false },
      { id: "b", played: false },
    ];
    reorderSongsForPlayed(songs, "b", true);
    expect(ids(songs)).toEqual(["a", "b"]);
  });

  it("returns the original list unchanged when the id is not present", () => {
    const songs: Row[] = [{ id: "a", played: false }];
    expect(reorderSongsForPlayed(songs, "zzz", true)).toBe(songs);
  });
});
