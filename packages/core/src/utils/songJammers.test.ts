import { describe, it, expect } from "vitest";
import { fetchSongJammers } from "./songJammers";

// Minimal stand-in for the chained Supabase query builder: every filter returns
// `this`, and awaiting it resolves the page named by the last `range` call.
function fakeClient(rows: any[]) {
  const calls: { songId?: string; ranges: [number, number][] } = { ranges: [] };
  const builder: any = {
    from: () => builder,
    select: () => builder,
    eq: (_col: string, val: string) => { calls.songId = val; return builder; },
    order: () => builder,
    range: (from: number, to: number) => {
      calls.ranges.push([from, to]);
      return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
    },
  };
  return { supabase: { from: builder.from }, calls };
}

const row = (userId: string, confidence: string, profile: any) => ({
  user_id: userId,
  confidence,
  profiles: profile,
});

describe("fetchSongJammers", () => {
  it("splits jammers by role", async () => {
    const { supabase } = fakeClient([
      row("u1", "lead", { display_name: "Aretha", last_name: "Franklin", username: "aretha" }),
      row("u2", "support", { display_name: "Otis", last_name: "Redding", username: "otis" }),
      row("u3", "learn", { display_name: "Nina", last_name: "Simone", username: "nina" }),
    ]);

    const jammers = await fetchSongJammers(supabase, "song-1");

    expect(jammers.lead.map((j) => j.name)).toEqual(["Aretha Franklin"]);
    expect(jammers.support.map((j) => j.name)).toEqual(["Otis Redding"]);
    expect(jammers.learn.map((j) => j.name)).toEqual(["Nina Simone"]);
  });

  it("joins display_name and last_name into a full name", async () => {
    const { supabase } = fakeClient([
      row("u1", "lead", { display_name: "Ben", last_name: "Kramarz", username: "ben" }),
    ]);
    expect((await fetchSongJammers(supabase, "s")).lead[0]).toEqual({
      userId: "u1",
      name: "Ben Kramarz",
      username: "ben",
    });
  });

  it("falls back to Unknown when the profile is missing or nameless", async () => {
    const { supabase } = fakeClient([
      row("u1", "lead", null),
      row("u2", "support", { display_name: null, last_name: null, username: "ghost" }),
    ]);
    const jammers = await fetchSongJammers(supabase, "s");
    expect(jammers.lead[0].name).toBe("Unknown");
    expect(jammers.lead[0].username).toBe("");
    expect(jammers.support[0].name).toBe("Unknown");
  });

  it("drops rows with a confidence outside the three known roles", async () => {
    const { supabase } = fakeClient([
      row("u1", "retired", { display_name: "Ghost", last_name: null, username: "ghost" }),
    ]);
    const jammers = await fetchSongJammers(supabase, "s");
    expect(jammers).toEqual({ lead: [], support: [], learn: [] });
  });

  it("pages past the first slice instead of truncating a popular song", async () => {
    const many = Array.from({ length: 1200 }, (_, i) =>
      row(`u${i}`, "learn", { display_name: `Jammer${i}`, last_name: null, username: `j${i}` })
    );
    const { supabase, calls } = fakeClient(many);

    const jammers = await fetchSongJammers(supabase, "s");

    expect(jammers.learn).toHaveLength(1200);
    expect(calls.ranges).toEqual([[0, 999], [1000, 1999]]);
  });

  it("filters on the requested song", async () => {
    const { supabase, calls } = fakeClient([]);
    await fetchSongJammers(supabase, "song-42");
    expect(calls.songId).toBe("song-42");
  });
});
