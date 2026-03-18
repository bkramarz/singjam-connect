"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type Lookup = { id: string; name: string };
type AltTitle = { id: string; title: string };

type Song = {
  id: string;
  title: string;
  display_artist: string | null;
  first_line: string | null;
  hook: string | null;
  lyrics: string | null;
  year: number | null;
  tonality: string | null;
  meter: string | null;
  energy: number | null;
  difficulty: number | null;
  popularity: number | null;
  song_genres: { genre_id: string }[];
  song_themes: { theme_id: string }[];
  song_cultures: { culture_id: string }[];
  song_languages: { language_id: string }[];
  song_traditions: { tradition_id: string }[];
  song_composers: { person_id: string }[];
  song_lyricists: { person_id: string }[];
  song_recording_artists: { artist_id: string; year: number | null }[];
  song_alternate_titles: AltTitle[];
};

type Props = {
  song: Song | null;
  isNew: boolean;
  allGenres: Lookup[];
  allThemes: Lookup[];
  allCultures: Lookup[];
  allLanguages: Lookup[];
  allTraditions: Lookup[];
  allPeople: Lookup[];
  allArtists: Lookup[];
};

function toSet(ids: string[]) {
  return new Set(ids);
}

export default function SongEditor({
  song,
  isNew,
  allGenres,
  allThemes,
  allCultures,
  allLanguages,
  allTraditions,
  allPeople,
  allArtists,
}: Props) {
  const supabase = supabaseBrowser();
  const router = useRouter();

  // Scalar fields
  const [title, setTitle] = useState(song?.title ?? "");
  const [displayArtist, setDisplayArtist] = useState(song?.display_artist ?? "");
  const [firstLine, setFirstLine] = useState(song?.first_line ?? "");
  const [hook, setHook] = useState(song?.hook ?? "");
  const [lyrics, setLyrics] = useState(song?.lyrics ?? "");
  const [year, setYear] = useState(song?.year?.toString() ?? "");
  const [tonality, setTonality] = useState(song?.tonality ?? "");
  const [meter, setMeter] = useState(song?.meter ?? "");
  const [energy, setEnergy] = useState(song?.energy?.toString() ?? "");
  const [difficulty, setDifficulty] = useState(song?.difficulty?.toString() ?? "");
  const [popularity, setPopularity] = useState(song?.popularity?.toString() ?? "");

  // Lookup associations
  const [genres, setGenres] = useState<Set<string>>(
    toSet(song?.song_genres.map((x) => x.genre_id) ?? [])
  );
  const [themes, setThemes] = useState<Set<string>>(
    toSet(song?.song_themes.map((x) => x.theme_id) ?? [])
  );
  const [cultures, setCultures] = useState<Set<string>>(
    toSet(song?.song_cultures.map((x) => x.culture_id) ?? [])
  );
  const [languages, setLanguages] = useState<Set<string>>(
    toSet(song?.song_languages.map((x) => x.language_id) ?? [])
  );
  const [traditions, setTraditions] = useState<Set<string>>(
    toSet(song?.song_traditions.map((x) => x.tradition_id) ?? [])
  );
  const initialComposerIds = song?.song_composers.map((x) => x.person_id) ?? [];
  const initialLyricistIds = song?.song_lyricists.map((x) => x.person_id) ?? [];
  const [composers, setComposers] = useState<Set<string>>(toSet(initialComposerIds));
  const [lyricists, setLyricists] = useState<Set<string>>(
    toSet(initialLyricistIds.length ? initialLyricistIds : initialComposerIds)
  );
  type RecordingArtistEntry = { id: string; year: number | null };
  const initialRecordingArtistEntries: RecordingArtistEntry[] = song?.song_recording_artists.map((x) => ({ id: x.artist_id, year: x.year })) ?? [];
  const seededRecordingArtistEntries: RecordingArtistEntry[] = initialRecordingArtistEntries.length
    ? initialRecordingArtistEntries
    : allArtists.filter((a) => a.name.toLowerCase() === (song?.display_artist ?? "").toLowerCase()).map((a) => ({ id: a.id, year: null }));
  const [recordingArtists, setRecordingArtists] = useState<RecordingArtistEntry[]>(seededRecordingArtistEntries);

  // Alternate titles
  const [altTitles, setAltTitles] = useState<AltTitle[]>(song?.song_alternate_titles ?? []);
  const [newAltTitle, setNewAltTitle] = useState("");

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [standardizing, setStandardizing] = useState(false);

  // New-song chunk-1 state
  const [finding, setFinding] = useState(false);
  const [found, setFound] = useState(false);
  const [newComposerName, setNewComposerName] = useState("");
  const [newLyricistName, setNewLyricistName] = useState("");
  const [newRecordingArtistName, setNewRecordingArtistName] = useState("");
  const [standardizedTitle, setStandardizedTitle] = useState("");
  const [standardizedArtist, setStandardizedArtist] = useState("");

  function toggleSet(set: Set<string>, setFn: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setFn(next);
  }

  // Find or create a person/artist by canonical name. Returns the DB id.
  async function resolvePersonName(
    name: string,
    table: "people" | "artists",
    allItems: Lookup[]
  ): Promise<string | null> {
    const normalised = name.trim().toLowerCase();
    const existing = allItems.find((p) => p.name.toLowerCase() === normalised);
    if (existing) return existing.id;

    const { data, error } = await supabase
      .from(table)
      .upsert({ name: name.trim() }, { onConflict: "name" })
      .select("id, name")
      .single();
    if (error) { setError(error.message); return null; }
    if (!allItems.find((p) => p.id === data.id)) allItems.push(data);
    return data.id;
  }

  async function handleFindComposers() {
    if (!title.trim()) return;
    setFinding(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/enrich?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(displayArtist)}`
      );
      const data = await res.json();
      const mb = data.musicbrainz as {
        title?: string;
        display_artist?: string;
        year?: number;
        composers?: string[];
        lyricists?: string[];
        topArtists?: { name: string; year: number | null }[];
      } | null;

      setStandardizedTitle(mb?.title ?? data.spotify?.title ?? title);
      setStandardizedArtist(mb?.display_artist ?? data.spotify?.artist ?? displayArtist);

      const shs = data.secondhandsongs as { composers?: string[]; lyricists?: string[]; year?: number } | null;

      // Prefer SHS year — it tracks the earliest known recording
      const bestYear = shs?.year ?? mb?.year;
      if (bestYear) setYear(bestYear.toString());

      // Resolve top artists from MB work recordings
      if (mb?.topArtists?.length) {
        const entries: { id: string; year: number | null }[] = [];
        for (const artist of (mb.topArtists as { name: string; year: number | null }[])) {
          const artistId = await resolvePersonName(artist.name, "artists", allArtists);
          if (artistId) entries.push({ id: artistId, year: artist.year });
        }
        if (entries.length) setRecordingArtists(entries);
      }

      // Cross-validate MB vs SHS composers:
      // If both agree (share a name) → trust MB (more structured data)
      // If they disagree → prefer SHS (authoritative for originals)
      // Fall back to Wikidata only if neither found anything
      const mbComposers = mb?.composers ?? [];
      const shsComposers = shs?.composers ?? [];
      const overlap = mbComposers.some((n: string) =>
        shsComposers.some((s: string) => s.toLowerCase() === n.toLowerCase())
      );
      const composerNames =
        mbComposers.length && shsComposers.length
          ? overlap ? mbComposers : shsComposers
          : mbComposers.length ? mbComposers
          : shsComposers.length ? shsComposers
          : (data.wikidata?.composers ?? []);

      const mbLyricists = mb?.lyricists ?? [];
      const shsLyricists = shs?.lyricists ?? [];
      const lyricistOverlap = mbLyricists.some((n: string) =>
        shsLyricists.some((s: string) => s.toLowerCase() === n.toLowerCase())
      );
      const lyricistNames =
        mbLyricists.length && shsLyricists.length
          ? lyricistOverlap ? mbLyricists : shsLyricists
          : mbLyricists.length ? mbLyricists
          : shsLyricists.length ? shsLyricists
          : data.wikidata?.lyricists?.length ? data.wikidata.lyricists
          : composerNames; // fall back to composers — common for singer-songwriters

      const [composerIds, lyricistIds] = await Promise.all([
        Promise.all(composerNames.map((n: string) => resolvePersonName(n, "people", allPeople))),
        Promise.all(lyricistNames.map((n: string) => resolvePersonName(n, "people", allPeople))),
      ]);
      setComposers(new Set(composerIds.filter((id: string | null): id is string => id !== null)));
      setLyricists(new Set(lyricistIds.filter((id: string | null): id is string => id !== null)));
      setFound(true);
    } catch {
      setError("Could not reach enrichment API. Check your network and API keys.");
    } finally {
      setFinding(false);
    }
  }

  async function handleSaveAndContinue() {
    if (!title.trim()) { setError("Title is required."); return; }
    setSaving(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("songs")
        .insert({
          title: (standardizedTitle || title).trim(),
          display_artist: (standardizedArtist || displayArtist).trim() || null,
          year: year ? parseInt(year) : null,
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw error;

      const songId = data.id;
      if (composers.size) {
        const { error: joinError } = await supabase
          .from("song_composers")
          .insert([...composers].map((id) => ({ song_id: songId, person_id: id })));
        if (joinError) throw joinError;
      }

      router.push(`/admin/songs/${songId}`);
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEnrich() {
    if (!title.trim()) return;
    setStandardizing(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/enrich?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(displayArtist)}`
      );
      const data = await res.json();
      const mb = data.musicbrainz as { topArtists?: { name: string; year: number | null }[] } | null;
      const shs = data.secondhandsongs as { year?: number } | null;

      if (mb?.topArtists?.length) {
        for (const artist of mb.topArtists) {
          const artistId = await resolvePersonName(artist.name, "artists", allArtists);
          if (artistId) {
            setRecordingArtists((prev) => {
              if (prev.find((e) => e.id === artistId)) return prev;
              return [...prev, { id: artistId, year: artist.year }];
            });
          }
        }
      }

      if (shs?.year) setYear(shs.year.toString());
    } catch {
      setError("Enrich failed. Check your API keys in .env.local.");
    } finally {
      setStandardizing(false);
    }
  }

  async function syncJoinTable(
    songId: string,
    table: string,
    fkCol: string,
    newIds: Set<string>,
    originalIds: string[]
  ) {
    const toAdd = [...newIds].filter((id) => !originalIds.includes(id));
    const toRemove = originalIds.filter((id) => !newIds.has(id));

    if (toAdd.length) {
      const { error } = await supabase
        .from(table)
        .insert(toAdd.map((id) => ({ song_id: songId, [fkCol]: id })));
      if (error) throw error;
    }

    if (toRemove.length) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq("song_id", songId)
        .in(fkCol, toRemove);
      if (error) throw error;
    }
  }

  async function handleSave() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        title: title.trim(),
        display_artist: recordingArtists.map((e) => allArtists.find((a) => a.id === e.id)?.name).filter(Boolean).join(" & ") || displayArtist.trim() || null,
        first_line: firstLine.trim() || null,
        hook: hook.trim() || null,
        lyrics: lyrics.trim() || null,
        year: year ? parseInt(year) : null,
        tonality: tonality.trim() || null,
        meter: meter.trim() || null,
        energy: energy ? parseInt(energy) : null,
        difficulty: difficulty ? parseInt(difficulty) : null,
        popularity: popularity ? parseInt(popularity) : null,
        updated_at: new Date().toISOString(),
      };

      let songId = song?.id;

      if (isNew) {
        const { data, error } = await supabase.from("songs").insert(payload).select("id").single();
        if (error) throw error;
        songId = data.id;
      } else {
        const { error } = await supabase.from("songs").update(payload).eq("id", songId!);
        if (error) throw error;
      }

      const originalGenres = song?.song_genres.map((x) => x.genre_id) ?? [];
      const originalThemes = song?.song_themes.map((x) => x.theme_id) ?? [];
      const originalCultures = song?.song_cultures.map((x) => x.culture_id) ?? [];
      const originalLanguages = song?.song_languages.map((x) => x.language_id) ?? [];
      const originalTraditions = song?.song_traditions.map((x) => x.tradition_id) ?? [];
      const originalComposers = song?.song_composers.map((x) => x.person_id) ?? [];
      const originalLyricists = song?.song_lyricists.map((x) => x.person_id) ?? [];
      const originalRecordingArtistIds = song?.song_recording_artists.map((x) => x.artist_id) ?? [];
      const newRecordingArtistIds = recordingArtists.map((e) => e.id);
      const toDeleteArtists = originalRecordingArtistIds.filter((id) => !newRecordingArtistIds.includes(id));

      await Promise.all([
        syncJoinTable(songId!, "song_genres", "genre_id", genres, originalGenres),
        syncJoinTable(songId!, "song_themes", "theme_id", themes, originalThemes),
        syncJoinTable(songId!, "song_cultures", "culture_id", cultures, originalCultures),
        syncJoinTable(songId!, "song_languages", "language_id", languages, originalLanguages),
        syncJoinTable(songId!, "song_traditions", "tradition_id", traditions, originalTraditions),
        syncJoinTable(songId!, "song_composers", "person_id", composers, originalComposers),
        syncJoinTable(songId!, "song_lyricists", "person_id", lyricists, originalLyricists),
        toDeleteArtists.length
          ? supabase.from("song_recording_artists").delete().eq("song_id", songId!).in("artist_id", toDeleteArtists)
          : Promise.resolve(),
        recordingArtists.length
          ? supabase.from("song_recording_artists").upsert(
              recordingArtists.map((e) => ({ song_id: songId!, artist_id: e.id, year: e.year })),
              { onConflict: "song_id,artist_id" }
            )
          : Promise.resolve(),
      ]);

      router.push("/admin/songs");
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function addAltTitle() {
    if (!newAltTitle.trim() || !song?.id) return;
    const { data, error } = await supabase
      .from("song_alternate_titles")
      .insert({ song_id: song.id, title: newAltTitle.trim() })
      .select("id, title")
      .single();
    if (error) { setError(error.message); return; }
    setAltTitles((prev) => [...prev, data]);
    setNewAltTitle("");
  }

  async function removeAltTitle(id: string) {
    await supabase.from("song_alternate_titles").delete().eq("id", id);
    setAltTitles((prev) => prev.filter((t) => t.id !== id));
  }

  // ── Chunk 1: new song form ────────────────────────────────────────────────
  if (isNew) {
    const composerItems = [...composers]
      .map((id) => allPeople.find((p) => p.id === id))
      .filter((p): p is Lookup => !!p);

    const lyricistItems = [...lyricists]
      .map((id) => allPeople.find((p) => p.id === id))
      .filter((p): p is Lookup => !!p);


    return (
      <div className="space-y-6 pb-16">
        <h1 className="text-xl font-semibold text-slate-900">Add song</h1>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title *">
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                className="input" placeholder="Song title" />
            </Field>
            <Field label="Artist">
              <input value={displayArtist} onChange={(e) => setDisplayArtist(e.target.value)}
                className="input" placeholder="e.g. The Beatles" />
            </Field>
          </div>
          <button
            onClick={handleFindComposers}
            disabled={finding || !title.trim()}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            {finding ? "Finding…" : "Find composers"}
          </button>
        </section>

        {found && (
          <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700">Results</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Standardized title">
                <input value={standardizedTitle} onChange={(e) => setStandardizedTitle(e.target.value)}
                  className="input" />
              </Field>
              <Field label="Standardized artist">
                <input value={standardizedArtist} onChange={(e) => setStandardizedArtist(e.target.value)}
                  className="input" />
              </Field>
            </div>

            <PeopleField
              label="Composers"
              items={composerItems}
              query={newComposerName}
              onQueryChange={setNewComposerName}
              suggestions={allPeople.filter(
                (p) => !composers.has(p.id) && p.name.toLowerCase().includes(newComposerName.toLowerCase().trim())
              )}
              onAdd={(p) => { setComposers((prev) => new Set([...prev, p.id])); setNewComposerName(""); }}
              onRemove={(id) => setComposers((prev) => { const s = new Set(prev); s.delete(id); return s; })}
            />

            <PeopleField
              label="Lyricists"
              items={lyricistItems}
              query={newLyricistName}
              onQueryChange={setNewLyricistName}
              suggestions={allPeople.filter(
                (p) => !lyricists.has(p.id) && p.name.toLowerCase().includes(newLyricistName.toLowerCase().trim())
              )}
              onAdd={(p) => { setLyricists((prev) => new Set([...prev, p.id])); setNewLyricistName(""); }}
              onRemove={(id) => setLyricists((prev) => { const s = new Set(prev); s.delete(id); return s; })}
            />

            <Field label="Year first recorded">
              <input type="number" value={year} onChange={(e) => setYear(e.target.value)}
                className="input" placeholder="e.g. 1965" />
            </Field>

            <RecordingArtistField
              items={recordingArtists}
              allArtists={allArtists}
              query={newRecordingArtistName}
              onQueryChange={setNewRecordingArtistName}
              onAdd={(a) => { setRecordingArtists((prev) => [...prev, { id: a.id, year: null }]); setNewRecordingArtistName(""); }}
              onRemove={(id) => setRecordingArtists((prev) => prev.filter((e) => e.id !== id))}
              onYearChange={(id, yr) => setRecordingArtists((prev) => prev.map((e) => e.id === id ? { ...e, year: yr } : e))}
            />
          </section>
        )}

        <button
          onClick={handleSaveAndContinue}
          disabled={saving || !title.trim()}
          className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-400 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save & continue"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">
          {title || "Edit song"}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={handleEnrich}
            disabled={standardizing || !title.trim()}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            {standardizing ? "Enriching…" : "✦ Enrich"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-400 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Scalar fields */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Core fields</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title *">
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="input" placeholder="Song title" />
          </Field>
        </div>

        <PeopleField
          label="Composers"
          items={[...composers].map((id) => allPeople.find((p) => p.id === id)).filter((p): p is Lookup => !!p)}
          query={newComposerName}
          onQueryChange={setNewComposerName}
          suggestions={allPeople.filter(
            (p) => !composers.has(p.id) && p.name.toLowerCase().includes(newComposerName.toLowerCase().trim())
          )}
          onAdd={(p) => { setComposers((prev) => new Set([...prev, p.id])); setNewComposerName(""); }}
          onRemove={(id) => setComposers((prev) => { const s = new Set(prev); s.delete(id); return s; })}
        />
        <PeopleField
          label="Lyricists"
          items={[...lyricists].map((id) => allPeople.find((p) => p.id === id)).filter((p): p is Lookup => !!p)}
          query={newLyricistName}
          onQueryChange={setNewLyricistName}
          suggestions={allPeople.filter(
            (p) => !lyricists.has(p.id) && p.name.toLowerCase().includes(newLyricistName.toLowerCase().trim())
          )}
          onAdd={(p) => { setLyricists((prev) => new Set([...prev, p.id])); setNewLyricistName(""); }}
          onRemove={(id) => setLyricists((prev) => { const s = new Set(prev); s.delete(id); return s; })}
        />
        <RecordingArtistField
          items={recordingArtists}
          allArtists={allArtists}
          query={newRecordingArtistName}
          onQueryChange={setNewRecordingArtistName}
          onAdd={(a) => { setRecordingArtists((prev) => [...prev, { id: a.id, year: null }]); setNewRecordingArtistName(""); }}
          onRemove={(id) => setRecordingArtists((prev) => prev.filter((e) => e.id !== id))}
          onYearChange={(id, year) => setRecordingArtists((prev) => prev.map((e) => e.id === id ? { ...e, year } : e))}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First line" className="sm:col-span-2">
            <input value={firstLine} onChange={(e) => setFirstLine(e.target.value)}
              className="input" placeholder="First sung line of the song" />
          </Field>
          <Field label="Hook / excerpt" className="sm:col-span-2">
            <input value={hook} onChange={(e) => setHook(e.target.value)}
              className="input" placeholder="Memorable lyric excerpt" />
          </Field>
          <Field label="Year">
            <input type="number" value={year} onChange={(e) => setYear(e.target.value)}
              className="input" placeholder="e.g. 1965" />
          </Field>
          <Field label="Tonality">
            <input value={tonality} onChange={(e) => setTonality(e.target.value)}
              className="input" placeholder="e.g. major, minor, modal" />
          </Field>
          <Field label="Meter">
            <input value={meter} onChange={(e) => setMeter(e.target.value)}
              className="input" placeholder="e.g. 4/4, 3/4, 6/8" />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Energy (1–5)">
            <RatingInput value={energy} onChange={setEnergy} />
          </Field>
          <Field label="Difficulty (1–5)">
            <RatingInput value={difficulty} onChange={setDifficulty} />
          </Field>
          <Field label="Popularity (1–5)">
            <RatingInput value={popularity} onChange={setPopularity} />
          </Field>
        </div>

        <Field label="Lyrics">
          <textarea value={lyrics} onChange={(e) => setLyrics(e.target.value)}
            rows={6} className="input resize-y" placeholder="Full lyrics…" />
        </Field>
      </section>

      {/* Lookups */}
      <LookupSection title="Genres" items={allGenres} selected={genres}
        onToggle={(id) => toggleSet(genres, setGenres, id)} />
      <LookupSection title="Themes" items={allThemes} selected={themes}
        onToggle={(id) => toggleSet(themes, setThemes, id)} />
      <LookupSection title="Cultures" items={allCultures} selected={cultures}
        onToggle={(id) => toggleSet(cultures, setCultures, id)} />
      <LookupSection title="Languages" items={allLanguages} selected={languages}
        onToggle={(id) => toggleSet(languages, setLanguages, id)} />
      <LookupSection title="Religious traditions" items={allTraditions} selected={traditions}
        onToggle={(id) => toggleSet(traditions, setTraditions, id)} />
      {/* Alternate titles */}
      {!isNew && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Alternate titles (AKA)</h2>
          <div className="flex gap-2">
            <input
              value={newAltTitle}
              onChange={(e) => setNewAltTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addAltTitle()}
              placeholder="Add alternate title…"
              className="input flex-1"
            />
            <button onClick={addAltTitle}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700">
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {altTitles.map((t) => (
              <span key={t.id}
                className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm">
                {t.title}
                <button onClick={() => removeAltTitle(t.id)}
                  className="text-slate-400 hover:text-red-500">×</button>
              </span>
            ))}
            {!altTitles.length && (
              <span className="text-sm text-slate-400">None added yet.</span>
            )}
          </div>
        </section>
      )}

      {!isNew && (
        <div className="border-t border-slate-200 pt-6">
          <button
            onClick={async () => {
              if (!confirm("Delete this song? This cannot be undone.")) return;
              const { error } = await supabase.from("songs").delete().eq("id", song!.id);
              if (error) { setError(error.message); return; }
              router.push("/admin/songs");
              router.refresh();
            }}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Delete song
          </button>
        </div>
      )}
    </div>
  );
}

function RecordingArtistField({
  items, allArtists, query, onQueryChange, onAdd, onRemove, onYearChange,
}: {
  items: { id: string; year: number | null }[];
  allArtists: Lookup[];
  query: string;
  onQueryChange: (v: string) => void;
  onAdd: (a: Lookup) => void;
  onRemove: (id: string) => void;
  onYearChange: (id: string, year: number | null) => void;
}) {
  const showSuggestions = query.trim().length > 0;
  const suggestions = allArtists.filter(
    (a) => !items.find((e) => e.id === a.id) && a.name.toLowerCase().includes(query.toLowerCase().trim())
  );
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-slate-600">Recording artists</label>
      <div className="flex flex-wrap gap-2">
        {items.map((e) => {
          const artist = allArtists.find((a) => a.id === e.id);
          return (
            <span key={e.id} className="flex items-center gap-1.5 rounded-full border border-amber-500 bg-amber-500 px-3 py-1 text-sm text-white">
              {artist?.name}
              <input
                type="number"
                value={e.year ?? ""}
                onChange={(ev) => onYearChange(e.id, ev.target.value ? parseInt(ev.target.value) : null)}
                placeholder="year"
                className="w-14 bg-transparent border-b border-white/60 text-white placeholder-white/60 text-xs focus:outline-none"
              />
              <button onClick={() => onRemove(e.id)} className="opacity-70 hover:opacity-100">×</button>
            </span>
          );
        })}
        {!items.length && <span className="text-sm text-slate-400">None found.</span>}
      </div>
      <div className="relative">
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search recording artists…"
          className="input w-full"
        />
        {showSuggestions && (
          <ul className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-md">
            {suggestions.slice(0, 6).map((a) => (
              <li key={a.id}>
                <button onMouseDown={() => onAdd(a)} className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50">
                  {a.name}
                </button>
              </li>
            ))}
            {!suggestions.length && (
              <li className="px-3 py-2 text-sm text-slate-400">No match — add to database first</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function PeopleField({
  label, items, query, onQueryChange, suggestions, onAdd, onRemove,
}: {
  label: string;
  items: Lookup[];
  query: string;
  onQueryChange: (v: string) => void;
  suggestions: Lookup[];
  onAdd: (p: Lookup) => void;
  onRemove: (id: string) => void;
}) {
  const showSuggestions = query.trim().length > 0;
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-slate-600">{label}</label>
      <div className="flex flex-wrap gap-2">
        {items.map((p) => (
          <span key={p.id}
            className="flex items-center gap-1.5 rounded-full border border-amber-500 bg-amber-500 px-3 py-1 text-sm text-white">
            {p.name}
            <button onClick={() => onRemove(p.id)} className="opacity-70 hover:opacity-100">×</button>
          </span>
        ))}
        {!items.length && <span className="text-sm text-slate-400">None found.</span>}
      </div>
      <div className="relative">
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={`Search ${label.toLowerCase()}…`}
          className="input w-full"
        />
        {showSuggestions && (
          <ul className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-md">
            {suggestions.slice(0, 6).map((p) => (
              <li key={p.id}>
                <button
                  onMouseDown={() => onAdd(p)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  {p.name}
                </button>
              </li>
            ))}
            {!suggestions.length && (
              <li className="px-3 py-2 text-sm text-slate-400">No match — add to database first</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}

function RatingInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n.toString() ? "" : n.toString())}
          className={`h-8 w-8 rounded-lg border text-sm font-medium transition-colors ${
            value === n.toString()
              ? "border-amber-500 bg-amber-500 text-white"
              : "border-slate-200 bg-white text-slate-500 hover:border-amber-300"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function LookupSection({
  title,
  items,
  selected,
  onToggle,
  creatable = false,
}: {
  title: string;
  items: Lookup[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  creatable?: boolean;
}) {
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const supabase = supabaseBrowser();

  const tableMap: Record<string, string> = {
    Genres: "genres",
    Themes: "themes",
    Cultures: "cultures",
    Languages: "languages",
    "Religious traditions": "traditions",
    Composers: "people",
    Lyricists: "people",
    "Recording artists": "artists",
  };

  async function create() {
    if (!newName.trim()) return;
    setAdding(true);
    const table = tableMap[title];
    const { data, error } = await supabase
      .from(table)
      .insert({ name: newName.trim() })
      .select("id, name")
      .single();
    setAdding(false);
    if (error) { alert(error.message); return; }
    items.push(data);
    onToggle(data.id);
    setNewName("");
  }

  const selectedItems = items.filter((item) => selected.has(item.id));
  const unselectedItems = items.filter((item) => !selected.has(item.id));

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
      <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {/* Selected items first */}
        {selectedItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onToggle(item.id)}
            className="rounded-full border border-amber-500 bg-amber-500 px-3 py-1 text-sm text-white transition-colors"
          >
            {item.name}
          </button>
        ))}
        {/* Unselected items */}
        {unselectedItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onToggle(item.id)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600 transition-colors hover:border-amber-300"
          >
            {item.name}
          </button>
        ))}
        {!items.length && (
          <span className="text-sm text-slate-400">No {title.toLowerCase()} yet.</span>
        )}
      </div>
      {creatable && (
        <div className="flex gap-2 pt-1">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder={`Add new ${title.toLowerCase().replace(/s$/, "")}…`}
            className="input flex-1"
          />
          <button onClick={create} disabled={adding}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40">
            {adding ? "…" : "Add"}
          </button>
        </div>
      )}
    </section>
  );
}
