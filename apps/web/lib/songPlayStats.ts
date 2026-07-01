export type JamForStats = {
  id: string;
  name: string | null;
  starts_at: string;
  sets: {
    set_songs: {
      songs: { id: string; title: string; slug: string | null; display_artist: string | null } | null;
    }[];
  }[];
};

export type SongPlayStat = {
  songId: string;
  title: string;
  slug: string | null;
  displayArtist: string | null;
  playCount: number;
  lastPlayedAt: string;
  lastJamName: string | null;
};

export function computeSongPlayStats(jams: JamForStats[]): SongPlayStat[] {
  const stats = new Map<string, SongPlayStat>();

  for (const jam of jams) {
    for (const set of jam.sets) {
      for (const setSong of set.set_songs) {
        const song = setSong.songs;
        if (!song) continue;

        const existing = stats.get(song.id);
        if (!existing) {
          stats.set(song.id, {
            songId: song.id,
            title: song.title,
            slug: song.slug,
            displayArtist: song.display_artist,
            playCount: 1,
            lastPlayedAt: jam.starts_at,
            lastJamName: jam.name,
          });
        } else {
          existing.playCount += 1;
          if (jam.starts_at > existing.lastPlayedAt) {
            existing.lastPlayedAt = jam.starts_at;
            existing.lastJamName = jam.name;
          }
        }
      }
    }
  }

  return [...stats.values()].sort((a, b) =>
    b.playCount - a.playCount ||
    b.lastPlayedAt.localeCompare(a.lastPlayedAt) ||
    a.title.localeCompare(b.title)
  );
}
