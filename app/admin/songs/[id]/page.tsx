import { supabaseServer } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import SongEditor from "./SongEditor";

export default async function AdminSongPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const isNew = id === "new";

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const [songRes, genresRes, themesRes, culturesRes, langsRes, peopleRes, artistsRes] =
    await Promise.all([
      isNew
        ? Promise.resolve({ data: null })
        : supabase
            .from("songs")
            .select(`
              *,
              song_genres(genre_id),
              song_themes(theme_id),
              song_cultures(culture_id),
              song_languages(language_id),
              song_composers(person_id),
              song_lyricists(person_id),
              song_recording_artists(artist_id, year),
              song_alternate_titles(id, title)
            `)
            .eq(isUuid ? "id" : "slug", id)
            .single(),
      supabase.from("genres").select("id, name").order("name"),
      supabase.from("themes").select("id, name").order("name"),
      supabase.from("cultures").select("id, name").order("name"),
      supabase.from("languages").select("id, name").order("name"),
      supabase.from("people").select("id, name").order("name"),
      supabase.from("artists").select("id, name").order("name"),
    ]);

  if (!isNew && !songRes.data) notFound();

  return (
    <SongEditor
      song={songRes.data}
      isNew={isNew}
      allGenres={genresRes.data ?? []}
      allThemes={themesRes.data ?? []}
      allCultures={culturesRes.data ?? []}
      allLanguages={langsRes.data ?? []}
      allPeople={peopleRes.data ?? []}
      allArtists={artistsRes.data ?? []}
    />
  );
}
