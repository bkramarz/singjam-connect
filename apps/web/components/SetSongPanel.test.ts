import { describe, it, expect } from "vitest";
import { displayedSongs, type SharedSong as Song } from "../lib/setDisplayedSongs";

function song(overrides: Partial<Song> & Pick<Song, "song_id" | "title">): Song {
  return {
    slug: overrides.title.toLowerCase(),
    display_artist: null,
    viewer_has: true,
    viewer_leads: false,
    who_else: [],
    who_else_leads: [],
    in_set: false,
    popularity: 0,
    ...overrides,
  };
}

const none = new Set<string>();

describe("displayedSongs — collaborative mode (isSolo = false)", () => {
  it("popular sort ranks by total who_else count descending", () => {
    const songs = [
      song({ song_id: "a", title: "Apple", who_else: ["Bob"] }),
      song({ song_id: "b", title: "Banana", who_else: ["Bob", "Carol"] }),
      song({ song_id: "c", title: "Cherry", who_else: [] }),
    ];
    const result = displayedSongs(songs, "popular", none, false);
    expect(result.map((s) => s.song_id)).toEqual(["b", "a", "c"]);
  });

  it("popular sort breaks ties alphabetically", () => {
    const songs = [
      song({ song_id: "a", title: "Zebra", who_else: ["Bob"] }),
      song({ song_id: "b", title: "Apple", who_else: ["Bob"] }),
    ];
    const result = displayedSongs(songs, "popular", none, false);
    expect(result.map((s) => s.song_id)).toEqual(["b", "a"]);
  });

  it("popular sort counts viewer_has as +1", () => {
    const songs = [
      song({ song_id: "a", title: "Apple", viewer_has: false, who_else: ["Bob"] }),
      song({ song_id: "b", title: "Banana", viewer_has: true, who_else: [] }),
    ];
    const result = displayedSongs(songs, "popular", none, false);
    expect(result.map((s) => s.song_id)).toEqual(["a", "b"]);
  });

  it("alpha sort returns A → Z", () => {
    const songs = [
      song({ song_id: "a", title: "Zebra" }),
      song({ song_id: "b", title: "Apple" }),
      song({ song_id: "c", title: "Mango" }),
    ];
    const result = displayedSongs(songs, "alpha", none, false);
    expect(result.map((s) => s.title)).toEqual(["Apple", "Mango", "Zebra"]);
  });

  it("za sort returns Z → A", () => {
    const songs = [
      song({ song_id: "a", title: "Apple" }),
      song({ song_id: "b", title: "Zebra" }),
      song({ song_id: "c", title: "Mango" }),
    ];
    const result = displayedSongs(songs, "za", none, false);
    expect(result.map((s) => s.title)).toEqual(["Zebra", "Mango", "Apple"]);
  });

  it("leader sort with no selection falls back to popular sort", () => {
    const songs = [
      song({ song_id: "a", title: "Apple", who_else: ["Bob"] }),
      song({ song_id: "b", title: "Banana", who_else: ["Bob", "Carol"] }),
    ];
    const result = displayedSongs(songs, "leader", none, false);
    expect(result.map((s) => s.song_id)).toEqual(["b", "a"]);
  });

  it("leader sort filters to songs where all selected leaders lead", () => {
    const songs = [
      song({ song_id: "a", title: "Apple", who_else_leads: ["Bob"] }),
      song({ song_id: "b", title: "Banana", who_else_leads: ["Bob", "Carol"] }),
      song({ song_id: "c", title: "Cherry", who_else_leads: ["Carol"] }),
    ];
    const result = displayedSongs(songs, "leader", new Set(["Bob", "Carol"]), false);
    expect(result.map((s) => s.song_id)).toEqual(["b"]);
  });

  it("leader sort includes songs where viewer_leads matches 'You'", () => {
    const songs = [
      song({ song_id: "a", title: "Apple", viewer_leads: true }),
      song({ song_id: "b", title: "Banana", viewer_leads: false }),
    ];
    const result = displayedSongs(songs, "leader", new Set(["You"]), false);
    expect(result.map((s) => s.song_id)).toEqual(["a"]);
  });

  it("does not mutate the original array", () => {
    const songs = [
      song({ song_id: "a", title: "Zebra" }),
      song({ song_id: "b", title: "Apple" }),
    ];
    const original = songs.map((s) => s.song_id);
    displayedSongs(songs, "alpha", none, false);
    expect(songs.map((s) => s.song_id)).toEqual(original);
  });
});

describe("displayedSongs — solo mode (isSolo = true)", () => {
  it("popular sort ranks by popularity field descending", () => {
    const songs = [
      song({ song_id: "a", title: "Apple", popularity: 5 }),
      song({ song_id: "b", title: "Banana", popularity: 20 }),
      song({ song_id: "c", title: "Cherry", popularity: 10 }),
    ];
    const result = displayedSongs(songs, "popular", none, true);
    expect(result.map((s) => s.song_id)).toEqual(["b", "c", "a"]);
  });

  it("popular sort breaks popularity ties alphabetically", () => {
    const songs = [
      song({ song_id: "a", title: "Zebra", popularity: 10 }),
      song({ song_id: "b", title: "Apple", popularity: 10 }),
    ];
    const result = displayedSongs(songs, "popular", none, true);
    expect(result.map((s) => s.song_id)).toEqual(["b", "a"]);
  });

  it("popular sort treats missing popularity as 0", () => {
    const songs = [
      song({ song_id: "a", title: "Apple" }),
      song({ song_id: "b", title: "Banana", popularity: 5 }),
    ];
    const result = displayedSongs(songs, "popular", none, true);
    expect(result.map((s) => s.song_id)).toEqual(["b", "a"]);
  });

  it("alpha and za sorts work the same as collaborative mode", () => {
    const songs = [
      song({ song_id: "a", title: "Zebra" }),
      song({ song_id: "b", title: "Apple" }),
    ];
    expect(displayedSongs(songs, "alpha", none, true).map((s) => s.title)).toEqual(["Apple", "Zebra"]);
    expect(displayedSongs(songs, "za", none, true).map((s) => s.title)).toEqual(["Zebra", "Apple"]);
  });
});
