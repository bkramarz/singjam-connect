import { fetchAllRows } from "./fetchAllRows";

export type SongJammer = {
  userId: string;
  name: string;
  username: string;
};

export type SongJammers = {
  lead: SongJammer[];
  support: SongJammer[];
  learn: SongJammer[];
};

// Who has this song in their repertoire, split by role. Both apps render the
// whole list, so this pages rather than taking the first slice, and it sorts on
// user_id — the only unique column here — so rows can't shift across pages.
// RLS on user_songs is what limits the result, so pass an authenticated client.
export async function fetchSongJammers(
  supabase: any,
  songId: string
): Promise<SongJammers> {
  const rows = await fetchAllRows<any>((from, to) =>
    supabase
      .from("user_songs")
      .select("confidence, user_id, profiles!user_id(display_name, last_name, username)")
      .eq("song_id", songId)
      .order("user_id")
      .range(from, to)
  );

  const jammers: SongJammers = { lead: [], support: [], learn: [] };
  for (const row of rows) {
    const p = row.profiles ?? null;
    const entry: SongJammer = {
      userId: row.user_id,
      name: [p?.display_name, p?.last_name].filter(Boolean).join(" ") || "Unknown",
      username: p?.username ?? "",
    };
    if (row.confidence === "lead") jammers.lead.push(entry);
    else if (row.confidence === "support") jammers.support.push(entry);
    else if (row.confidence === "learn") jammers.learn.push(entry);
  }
  return jammers;
}
