import { describe, it, expect } from "vitest";
import { computeSongPlayStats, type JamForStats } from "./songPlayStats";

function song(id: string, title: string, overrides: Partial<{ slug: string | null; display_artist: string | null }> = {}) {
  return { id, title, slug: overrides.slug ?? null, display_artist: overrides.display_artist ?? null };
}

function jam(id: string, name: string, startsAt: string, songs: { id: string; title: string; slug: string | null; display_artist: string | null }[][]): JamForStats {
  return {
    id,
    name,
    starts_at: startsAt,
    sets: songs.map((setSongs) => ({
      set_songs: setSongs.map((s) => ({ songs: s })),
    })),
  };
}

describe("computeSongPlayStats", () => {
  it("counts one play per set_songs row across jams", () => {
    const jams = [
      jam("j1", "Jam 1", "2026-01-01T00:00:00Z", [[song("s1", "Amazing Grace")]]),
      jam("j2", "Jam 2", "2026-02-01T00:00:00Z", [[song("s1", "Amazing Grace")]]),
    ];
    const result = computeSongPlayStats(jams);
    expect(result).toHaveLength(1);
    expect(result[0].playCount).toBe(2);
  });

  it("counts a song appearing in two sets of the same jam twice", () => {
    const jams = [
      jam("j1", "Jam 1", "2026-01-01T00:00:00Z", [
        [song("s1", "Amazing Grace")],
        [song("s1", "Amazing Grace")],
      ]),
    ];
    const result = computeSongPlayStats(jams);
    expect(result[0].playCount).toBe(2);
  });

  it("tracks the most recent jam as last played", () => {
    const jams = [
      jam("j1", "January Jam", "2026-01-01T00:00:00Z", [[song("s1", "Amazing Grace")]]),
      jam("j2", "March Jam", "2026-03-01T00:00:00Z", [[song("s1", "Amazing Grace")]]),
      jam("j3", "February Jam", "2026-02-01T00:00:00Z", [[song("s1", "Amazing Grace")]]),
    ];
    const result = computeSongPlayStats(jams);
    expect(result[0].lastPlayedAt).toBe("2026-03-01T00:00:00Z");
    expect(result[0].lastJamName).toBe("March Jam");
  });

  it("sorts by play count desc, then last played desc, then title asc", () => {
    const jams = [
      jam("j1", "Jam 1", "2026-01-01T00:00:00Z", [[song("s1", "Zebra Song"), song("s2", "Amazing Grace")]]),
      jam("j2", "Jam 2", "2026-02-01T00:00:00Z", [[song("s2", "Amazing Grace")]]),
      jam("j3", "Jam 3", "2026-03-01T00:00:00Z", [[song("s3", "Beautiful Day")]]),
    ];
    const result = computeSongPlayStats(jams);
    expect(result.map((r) => r.title)).toEqual(["Amazing Grace", "Beautiful Day", "Zebra Song"]);
  });

  it("skips set_songs rows with a null song without throwing", () => {
    const jams: JamForStats[] = [
      {
        id: "j1",
        name: "Jam 1",
        starts_at: "2026-01-01T00:00:00Z",
        sets: [{ set_songs: [{ songs: null }, { songs: song("s1", "Amazing Grace") }] }],
      },
    ];
    const result = computeSongPlayStats(jams);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Amazing Grace");
  });
});
