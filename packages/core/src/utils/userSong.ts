// The shape a repertoire row is rendered from, shared by native's repertoire
// list and SongRow. The rows themselves come from the `my_repertoire()` RPC.
export type UserSong = {
  song_id: string;
  slug: string | null;
  confidence: string;
  updated_at: string | null;
  title: string;
  display_artist: string | null;
  composers: string[];
  cultures: string[];
};
