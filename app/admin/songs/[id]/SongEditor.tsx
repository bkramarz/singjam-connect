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
  song_recording_artists: { artist_id: string }[];
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

type EnrichSuggestions = {
  musicbrainz?: {
    title?: string;
    year?: number;
    display_artist?: string;
    languages?: string[];
    composers?: string[];
    lyricists?: string[];
    recording_artists?: string[];
  };
  wikidata?: {
    composers?: string[];
    lyricists?: string[];
  };
  spotify?: {
    popularity?: number;
    energy?: number;
    genres?: string[];
  };
  genius?: {
    first_line?: string;
    lyrics_url?: string;
  };
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
  const [composers, setComposers] = useState<Set<string>>(
    toSet(song?.song_composers.map((x) => x.person_id) ?? [])
  );
  const [lyricists, setLyricists] = useState<Set<string>>(
    toSet(song?.song_lyricists.map((x) => x.person_id) ?? [])
  );
  const [recordingArtists, setRecordingArtists] = useState<Set<string>>(
    toSet(song?.song_recording_artists.map((x) => x.artist_id) ?? [])
  );

  // Alternate titles
  const [altTitles, setAltTitles] = useState<AltTitle[]>(song?.song_alternate_titles ?? []);
  const [newAltTitle, setNewAltTitle] = useState("");

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [suggestions, setSuggestions] = useState<EnrichSuggestions | null>(null);

  function toggleSet(set: Set<string>, setFn: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setFn(next);
  }

  async function handleEnrich() {
    if (!title) return;
    setEnriching(true);
    setSuggestions(null);
    try {
      const res = await fetch(
        `/api/enrich?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(displayArtist)}`
      );
      const data = await res.json();
      setSuggestions(data);
    } catch {
      setError("Enrichment failed. Check your API keys in Netlify env vars.");
    } finally {
      setEnriching(false);
    }
  }

  // Find or create a person/artist by canonical name, then toggle into the given set
  async function applyPerson(
    name: string,
    table: "people" | "artists",
    currentSet: Set<string>,
    setFn: (s: Set<string>) => void,
    allItems: Lookup[]
  ) {
    const normalised = name.trim().toLowerCase();
    const existing = allItems.find((p) => p.name.toLowerCase() === normalised);
    if (existing) {
      const next = new Set(currentSet);
      next.add(existing.id);
      setFn(next);
      return;
    }
    const { data, error } = await supabase
      .from(table)
      .insert({ name: name.trim() })
      .select("id, name")
      .single();
    if (error) { setError(error.message); return; }
    allItems.push(data);
    const next = new Set(currentSet);
    next.add(data.id);
    setFn(next);
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
        display_artist: displayArtist.trim() || null,
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
      const originalRecordingArtists = song?.song_recording_artists.map((x) => x.artist_id) ?? [];

      await Promise.all([
        syncJoinTable(songId!, "song_genres", "genre_id", genres, originalGenres),
        syncJoinTable(songId!, "song_themes", "theme_id", themes, originalThemes),
        syncJoinTable(songId!, "song_cultures", "culture_id", cultures, originalCultures),
        syncJoinTable(songId!, "song_languages", "language_id", languages, originalLanguages),
        syncJoinTable(songId!, "song_traditions", "tradition_id", traditions, originalTraditions),
        syncJoinTable(songId!, "song_composers", "person_id", composers, originalComposers),
        syncJoinTable(songId!, "song_lyricists", "person_id", lyricists, originalLyricists),
        syncJoinTable(
          songId!,
          "song_recording_artists",
          "artist_id",
          recordingArtists,
          originalRecordingArtists
        ),
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

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">
          {isNew ? "New song" : title || "Edit song"}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={handleEnrich}
            disabled={enriching || !title}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            {enriching ? "Enriching…" : "✦ Enrich from APIs"}
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

      {/* API Suggestions panel */}
      {suggestions && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3">
          <div className="text-sm font-semibold text-indigo-800">✦ Enrichment suggestions</div>

          {suggestions.musicbrainz && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-indigo-600 uppercase tracking-wide">MusicBrainz</div>
              <div className="flex flex-wrap gap-2">
                {suggestions.musicbrainz.title && (
                  <button onClick={() => setTitle(suggestions.musicbrainz!.title!)}
                    className="rounded border border-indigo-300 bg-white px-2 py-1 text-xs hover:bg-indigo-100">
                    Title: {suggestions.musicbrainz.title}
                  </button>
                )}
                {suggestions.musicbrainz.year && (
                  <button onClick={() => setYear(suggestions.musicbrainz!.year!.toString())}
                    className="rounded border border-indigo-300 bg-white px-2 py-1 text-xs hover:bg-indigo-100">
                    Year: {suggestions.musicbrainz.year}
                  </button>
                )}
                {suggestions.musicbrainz.display_artist && (
                  <button onClick={() => setDisplayArtist(suggestions.musicbrainz!.display_artist!)}
                    className="rounded border border-indigo-300 bg-white px-2 py-1 text-xs hover:bg-indigo-100">
                    Artist: {suggestions.musicbrainz.display_artist}
                  </button>
                )}
                {suggestions.musicbrainz.languages?.map((l) => (
                  <span key={l} className="rounded border border-indigo-200 bg-white px-2 py-1 text-xs text-indigo-700">
                    Lang: {l}
                  </span>
                ))}
              </div>
              {!!suggestions.musicbrainz.composers?.length && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-indigo-500">Composers:</span>
                  {suggestions.musicbrainz.composers.map((name) => {
                    const already = allPeople.find((p) => p.name.toLowerCase() === name.toLowerCase()) &&
                      composers.has(allPeople.find((p) => p.name.toLowerCase() === name.toLowerCase())!.id);
                    return (
                      <button
                        key={name}
                        disabled={!!already}
                        onClick={() => applyPerson(name, "people", composers, setComposers, allPeople)}
                        className="rounded border border-indigo-300 bg-white px-2 py-1 text-xs hover:bg-indigo-100 disabled:opacity-40"
                      >
                        {already ? "✓ " : "+ "}{name}
                      </button>
                    );
                  })}
                </div>
              )}
              {!!suggestions.musicbrainz.lyricists?.length && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-indigo-500">Lyricists:</span>
                  {suggestions.musicbrainz.lyricists.map((name) => {
                    const already = allPeople.find((p) => p.name.toLowerCase() === name.toLowerCase()) &&
                      lyricists.has(allPeople.find((p) => p.name.toLowerCase() === name.toLowerCase())!.id);
                    return (
                      <button
                        key={name}
                        disabled={!!already}
                        onClick={() => applyPerson(name, "people", lyricists, setLyricists, allPeople)}
                        className="rounded border border-indigo-300 bg-white px-2 py-1 text-xs hover:bg-indigo-100 disabled:opacity-40"
                      >
                        {already ? "✓ " : "+ "}{name}
                      </button>
                    );
                  })}
                </div>
              )}
              {!!suggestions.musicbrainz.recording_artists?.length && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-indigo-500">Recording artists:</span>
                  {suggestions.musicbrainz.recording_artists.map((name) => {
                    const already = allArtists.find((a) => a.name.toLowerCase() === name.toLowerCase()) &&
                      recordingArtists.has(allArtists.find((a) => a.name.toLowerCase() === name.toLowerCase())!.id);
                    return (
                      <button
                        key={name}
                        disabled={!!already}
                        onClick={() => applyPerson(name, "artists", recordingArtists, setRecordingArtists, allArtists)}
                        className="rounded border border-indigo-300 bg-white px-2 py-1 text-xs hover:bg-indigo-100 disabled:opacity-40"
                      >
                        {already ? "✓ " : "+ "}{name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {suggestions.wikidata && (suggestions.wikidata.composers?.length || suggestions.wikidata.lyricists?.length) && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-violet-600 uppercase tracking-wide">Wikidata</div>
              {!!suggestions.wikidata.composers?.length && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-violet-500">Composers:</span>
                  {suggestions.wikidata.composers.map((name) => {
                    const already = allPeople.find((p) => p.name.toLowerCase() === name.toLowerCase()) &&
                      composers.has(allPeople.find((p) => p.name.toLowerCase() === name.toLowerCase())!.id);
                    return (
                      <button
                        key={name}
                        disabled={!!already}
                        onClick={() => applyPerson(name, "people", composers, setComposers, allPeople)}
                        className="rounded border border-violet-300 bg-white px-2 py-1 text-xs hover:bg-violet-100 disabled:opacity-40"
                      >
                        {already ? "✓ " : "+ "}{name}
                      </button>
                    );
                  })}
                </div>
              )}
              {!!suggestions.wikidata.lyricists?.length && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-violet-500">Lyricists:</span>
                  {suggestions.wikidata.lyricists.map((name) => {
                    const already = allPeople.find((p) => p.name.toLowerCase() === name.toLowerCase()) &&
                      lyricists.has(allPeople.find((p) => p.name.toLowerCase() === name.toLowerCase())!.id);
                    return (
                      <button
                        key={name}
                        disabled={!!already}
                        onClick={() => applyPerson(name, "people", lyricists, setLyricists, allPeople)}
                        className="rounded border border-violet-300 bg-white px-2 py-1 text-xs hover:bg-violet-100 disabled:opacity-40"
                      >
                        {already ? "✓ " : "+ "}{name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {suggestions.spotify && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-emerald-600 uppercase tracking-wide">Spotify</div>
              <div className="flex flex-wrap gap-2">
                {suggestions.spotify.popularity && (
                  <button onClick={() => setPopularity(suggestions.spotify!.popularity!.toString())}
                    className="rounded border border-emerald-300 bg-white px-2 py-1 text-xs hover:bg-emerald-100">
                    Popularity: {suggestions.spotify.popularity}/5
                  </button>
                )}
                {suggestions.spotify.energy && (
                  <button onClick={() => setEnergy(suggestions.spotify!.energy!.toString())}
                    className="rounded border border-emerald-300 bg-white px-2 py-1 text-xs hover:bg-emerald-100">
                    Energy: {suggestions.spotify.energy}/5
                  </button>
                )}
              </div>
            </div>
          )}

          {suggestions.genius && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-orange-600 uppercase tracking-wide">Genius</div>
              <div className="flex flex-wrap gap-2">
                {suggestions.genius.first_line && (
                  <button onClick={() => setFirstLine(suggestions.genius!.first_line!)}
                    className="rounded border border-orange-300 bg-white px-2 py-1 text-xs hover:bg-orange-100">
                    First line: "{suggestions.genius.first_line}"
                  </button>
                )}
                {suggestions.genius.lyrics_url && (
                  <a href={suggestions.genius.lyrics_url} target="_blank" rel="noopener noreferrer"
                    className="rounded border border-orange-300 bg-white px-2 py-1 text-xs hover:bg-orange-100 text-orange-700">
                    View lyrics on Genius ↗
                  </a>
                )}
              </div>
            </div>
          )}
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
          <Field label="Display artist">
            <input value={displayArtist} onChange={(e) => setDisplayArtist(e.target.value)}
              className="input" placeholder="e.g. The Beatles" />
          </Field>
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
      <LookupSection title="Composers" items={allPeople} selected={composers}
        onToggle={(id) => toggleSet(composers, setComposers, id)} creatable />
      <LookupSection title="Lyricists" items={allPeople} selected={lyricists}
        onToggle={(id) => toggleSet(lyricists, setLyricists, id)} creatable />
      <LookupSection title="Recording artists" items={allArtists} selected={recordingArtists}
        onToggle={(id) => toggleSet(recordingArtists, setRecordingArtists, id)} creatable />

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

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
      <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onToggle(item.id)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              selected.has(item.id)
                ? "border-amber-500 bg-amber-500 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-amber-300"
            }`}
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
