export type ProfileSong = {
  song_id: string;
  title: string;
  display_artist: string | null;
  confidence: string | null;
};

export async function fetchProfileSongs(
  supabase: any,
  profileId: string
): Promise<{ sharedSongs: ProfileSong[]; additionalSongs: ProfileSong[] }> {
  const [{ data: shared }, { data: theirSongs }] = await Promise.all([
    supabase.rpc("shared_songs_with", { other_user_id: profileId }),
    supabase.from("user_songs").select("song_id, confidence").eq("user_id", profileId),
  ]);

  const confidenceMap = new Map(
    (theirSongs ?? []).map((r: any) => [r.song_id, r.confidence])
  );

  const sharedSongs: ProfileSong[] = (shared ?? []).map((s: any) => ({
    song_id: s.song_id as string,
    title: s.title as string,
    display_artist: (s.display_artist ?? null) as string | null,
    confidence: (confidenceMap.get(s.song_id) ?? null) as string | null,
  }));

  const sharedIds = new Set(sharedSongs.map((s) => s.song_id));
  const additionalIds = (theirSongs ?? [])
    .filter((r: any) => !sharedIds.has(r.song_id))
    .map((r: any) => r.song_id as string);

  let additionalSongs: ProfileSong[] = [];
  if (additionalIds.length > 0) {
    const { data: songDetails } = await supabase
      .from("songs")
      .select("id, title, display_artist")
      .in("id", additionalIds);
    additionalSongs = (songDetails ?? [])
      .map((s: any) => ({
        song_id: s.id as string,
        title: s.title as string,
        display_artist: (s.display_artist ?? null) as string | null,
        confidence: (confidenceMap.get(s.id) ?? null) as string | null,
      }))
      .sort((a: ProfileSong, b: ProfileSong) => a.title.localeCompare(b.title));
  }

  return { sharedSongs, additionalSongs };
}
