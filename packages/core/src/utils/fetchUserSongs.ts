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

export async function fetchUserSongs(supabase: any, userId: string): Promise<UserSong[]> {
  const { data, error } = await supabase
    .from('user_songs')
    .select(`
      song_id,
      confidence,
      updated_at,
      songs (
        title,
        slug,
        display_artist,
        song_composers ( people ( name ) ),
        song_lyricists ( people ( name ) ),
        song_cultures ( cultures ( name ) )
      )
    `)
    .eq('user_id', userId)
    .limit(1000);

  if (error) throw error;

  return (data ?? [])
    .filter((row: any) => row.songs)
    .map((row: any) => ({
      song_id: row.song_id,
      slug: row.songs.slug ?? null,
      confidence: row.confidence ?? 'learn',
      updated_at: row.updated_at,
      title: row.songs.title ?? '',
      display_artist: row.songs.display_artist ?? null,
      composers: [
        ...(row.songs.song_composers?.map((c: any) => c.people?.name).filter(Boolean) ?? []),
        ...(row.songs.song_lyricists?.map((l: any) => l.people?.name).filter(Boolean) ?? []),
      ],
      cultures: row.songs.song_cultures?.map((c: any) => c.cultures?.name).filter(Boolean) ?? [],
    }))
    .sort((a: UserSong, b: UserSong) => a.title.localeCompare(b.title));
}
