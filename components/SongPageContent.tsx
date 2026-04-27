"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import RepertoireButton from "@/components/RepertoireButton";

function formatComposersLong(names: string[], cultures: string[]): string {
  const isTraditional = names.some((n) => n.toLowerCase() === "traditional");
  const others = names.filter((n) => n.toLowerCase() !== "traditional");
  const parts: string[] = [];
  if (isTraditional) {
    const culture = cultures[0];
    parts.push(culture ? `Traditional - ${culture}` : "Traditional");
  }
  parts.push(...others);
  return parts.join(", ");
}

function TagRow({ label, tags }: { label: string; tags: string[] }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="text-xs font-medium text-slate-500 w-20 shrink-0">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span key={t} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

type SongData = {
  song: any;
  isAdmin: boolean;
  singingVoice: string | null;
  userSongConfidence: string | null;
};

export default function SongPageContent() {
  const params = useParams();
  const slug = params.slug as string;
  const [data, setData] = useState<SongData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const supabase = supabaseBrowser();

  useEffect(() => {
    (async () => {
      setData(null);
      setNotFound(false);

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

      const [{ data: { user } }, songRes] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("songs").select(`
          id, title, slug, display_artist, first_line, hook, notes, genius_url, chord_chart_url, youtube_url, year, year_written, tonality, meter, vibe,
          song_composers(people(name)),
          song_lyricists(people(name)),
          song_recording_artists(year, position, artists(name)),
          song_alternate_titles(title),
          song_genres(genres(name)),
          song_themes(themes(name)),
          song_cultures(context, cultures(name)),
          song_languages(languages(name)),
          song_productions(productions(name))
        `).eq(isUuid ? "id" : "slug", slug).single(),
      ]);

      if (!songRes.data) { setNotFound(true); return; }

      const song = songRes.data;

      const [profileRes, userSongRes] = await Promise.all([
        user
          ? supabase.from("profiles").select("is_admin, singing_voice").eq("id", user.id).single()
          : Promise.resolve({ data: null }),
        user
          ? supabase.from("user_songs").select("confidence").eq("user_id", user.id).eq("song_id", song.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      setData({
        song,
        isAdmin: (profileRes.data as any)?.is_admin ?? false,
        singingVoice: (profileRes.data as any)?.singing_voice ?? null,
        userSongConfidence: (userSongRes.data as any)?.confidence ?? null,
      });
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (notFound) return <p className="text-sm text-slate-500">Song not found.</p>;
  if (!data) return null;

  const { song, isAdmin, singingVoice, userSongConfidence } = data;

  const composers = (song.song_composers as any[]).map((x: any) => x.people?.name).filter(Boolean) as string[];
  const lyricists = (song.song_lyricists as any[]).map((x: any) => x.people?.name).filter(Boolean) as string[];
  const cultureRows = song.song_cultures as any[];
  const musicSpecificRows = cultureRows.filter((x: any) => x.context === "music");
  const lyricsSpecificRows = cultureRows.filter((x: any) => x.context === "lyrics");
  const noContextRows = cultureRows.filter((x: any) => !x.context);
  const musicCultures = (musicSpecificRows.length ? musicSpecificRows : noContextRows)
    .map((x: any) => x.cultures?.name).filter(Boolean) as string[];
  const lyricsCultures = (lyricsSpecificRows.length ? lyricsSpecificRows : noContextRows)
    .map((x: any) => x.cultures?.name).filter(Boolean) as string[];
  const recordingArtists = (song.song_recording_artists as any[])
    .map((x: any) => ({ name: x.artists?.name as string, year: x.year as number | null, position: x.position as number | null }))
    .filter((x: any) => x.name)
    .sort((a: any, b: any) => (a.position ?? 999) - (b.position ?? 999));
  const altTitles = (song.song_alternate_titles as any[]).map((x: any) => x.title as string).filter(Boolean);
  const genres = (song.song_genres as any[]).map((x: any) => x.genres?.name as string).filter(Boolean).sort();
  const themes = (song.song_themes as any[]).map((x: any) => x.themes?.name as string).filter(Boolean).sort();
  const cultures = [...new Set((song.song_cultures as any[]).map((x: any) => x.cultures?.name as string).filter(Boolean))];
  const languages = (song.song_languages as any[]).map((x: any) => x.languages?.name as string).filter(Boolean);
  const songProductions = (song.song_productions as any[]).map((x: any) => x.productions?.name as string).filter(Boolean);
  const firstRecorded = recordingArtists.find((a: any) => a.year)?.year ?? song.year;
  const tonalityPills = song.tonality ? song.tonality.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
  const meterPills = song.meter ? song.meter.split(",").map((s: string) => s.trim()).filter(Boolean) : [];

  return (
    <div className="space-y-6 pb-16">
      <div>
        <div>
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold text-slate-900">{song.title}</h1>
            {firstRecorded && (
              <span className="shrink-0 text-sm text-slate-400">{firstRecorded}</span>
            )}
          </div>
          {songProductions.length > 0 ? (
            <p className="mt-0.5 text-base text-slate-500">from <em>{songProductions.join(", ")}</em></p>
          ) : song.display_artist ? (
            <p className="mt-0.5 text-base text-slate-500">{song.display_artist}</p>
          ) : null}
          {altTitles.length > 0 && (
            <p className="mt-1 text-sm text-slate-400">aka: {altTitles.join(" · ")}</p>
          )}
          <div className="mt-3">
            <RepertoireButton songId={song.id} initialConfidence={userSongConfidence} singingVoice={singingVoice} />
          </div>
        </div>

        {(composers.length > 0 || lyricists.length > 0) && (
          <div className="mt-3 flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Songwriter(s)</p>
            {composers.length > 0 && (
              <p className="text-sm text-slate-600">
                <span className="font-medium">Music:</span> {formatComposersLong(composers, musicCultures)}
              </p>
            )}
            {lyricists.length > 0 && (
              <p className="text-sm text-slate-600">
                <span className="font-medium">Lyrics:</span> {formatComposersLong(lyricists, lyricsCultures)}
              </p>
            )}
          </div>
        )}
      </div>

      {(recordingArtists.length > 0 || song.year_written) && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          {song.year_written && (
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Written:</span> {song.year_written}
            </p>
          )}
          {recordingArtists.length > 0 && (
            <>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recordings</h2>
              <div className="flex flex-wrap gap-2">
                {recordingArtists.map((a: any, i: number) => (
                  <span key={i} className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                    {a.name}
                    {a.year && <span className="text-slate-400">{a.year}</span>}
                  </span>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {song.youtube_url && (() => {
        let videoId: string | null = null;
        try { videoId = new URL(song.youtube_url).searchParams.get("v"); } catch { return null; }
        if (!videoId) return null;
        return (
          <section className="rounded-xl overflow-hidden border border-slate-200">
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${videoId}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </section>
        );
      })()}

      {(song.first_line || song.hook || song.genius_url || song.chord_chart_url) && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lyrics</h2>
          {song.first_line && (
            <p className="text-sm text-slate-700">
              <span className="font-medium text-slate-500">Opens: </span>
              <em>{song.first_line}</em>
            </p>
          )}
          {song.hook && (
            <p className="text-sm text-slate-700">
              <span className="font-medium text-slate-500">Hook: </span>
              <em>{song.hook}</em>
            </p>
          )}
          {(song.genius_url || song.chord_chart_url) && (
            <div className="flex gap-2 pt-1">
              {song.genius_url && (
                <a href={song.genius_url} target="_blank" rel="noopener noreferrer"
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-amber-400 hover:text-amber-600">
                  Full lyrics ↗
                </a>
              )}
              {song.chord_chart_url && (
                <a href={song.chord_chart_url} target="_blank" rel="noopener noreferrer"
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-amber-400 hover:text-amber-600">
                  Chord chart ↗
                </a>
              )}
            </div>
          )}
        </section>
      )}

      {(tonalityPills.length > 0 || meterPills.length > 0 || song.vibe) && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Musical properties</h2>
          {tonalityPills.length > 0 && <TagRow label="Tonality" tags={tonalityPills} />}
          {meterPills.length > 0 && <TagRow label="Meter" tags={meterPills} />}
          {song.vibe && <TagRow label="Vibe" tags={[song.vibe]} />}
        </section>
      )}

      {(genres.length > 0 || themes.length > 0 || cultures.length > 0 || languages.length > 0) && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tags</h2>
          {genres.length > 0 && <TagRow label="Genres" tags={genres} />}
          {themes.length > 0 && <TagRow label="Themes" tags={themes} />}
          {languages.length > 0 && <TagRow label="Languages" tags={languages} />}
          {cultures.length > 0 && <TagRow label="Cultures" tags={cultures} />}
        </section>
      )}

      {song.notes && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</h2>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{song.notes}</p>
        </section>
      )}

      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <RepertoireButton songId={song.id} initialConfidence={userSongConfidence} singingVoice={singingVoice} />
          {isAdmin && (
            <Link href={`/admin/songs/${song.slug ?? song.id}`}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Edit
            </Link>
          )}
        </div>
        <Link href={userSongConfidence ? "/repertoire" : "/search"}
          className="mt-2 text-center text-sm text-slate-500 hover:text-slate-700 sm:mt-0 sm:text-left">
          {userSongConfidence ? "← Back to repertoire" : "← Back to search"}
        </Link>
      </div>
    </div>
  );
}
