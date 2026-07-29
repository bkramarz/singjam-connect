import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  ActionSheetIOS, Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { songMatchesFilters, deriveFilterOptions, countActiveFilters, type SongFilterState } from '@singjam/core';
import { supabase } from '@/lib/supabase';
import ContentContainer from '@/components/ContentContainer';
import SubmitMissingSong from '@/components/SubmitMissingSong';
import SuggestionCard from '@/components/SuggestionCard';
import SongFilterSheet, { emptyFilterDimensions } from '@/components/SongFilterSheet';

// A superset of SuggestionCard's `Suggestion`, so catalog rows render in the
// same card web uses while still carrying the fields the filters need.
type SongMeta = {
  song_id: string;
  title: string;
  display_artist: string | null;
  first_line: string | null;
  slug: string | null;
  composers: string[];
  productions: string[];
  popularity: number;
  genres: string[];
  cultures: string[];
  languages: string[];
  themes: string[];
  vibe: string | null;
  tonality: string | null;
  meter: string | null;
  year: number | null;
  youtube_id: string | null;
  spotify_track_id: string | null;
};

type SortBy = 'popularity' | 'title_asc' | 'title_desc';

const SORT_OPTIONS: { key: SortBy; label: string }[] = [
  { key: 'popularity', label: 'Popular' },
  { key: 'title_asc', label: 'A → Z' },
  { key: 'title_desc', label: 'Z → A' },
];

function SkeletonCard() {
  return (
    <View className="mx-4 mb-2 rounded-2xl border border-zinc-200 bg-white p-4">
      <View className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
      <View className="h-3 bg-slate-100 rounded w-1/2 mb-3" />
      <View className="flex-row" style={{ gap: 6 }}>
        <View className="h-8 w-36 bg-slate-100 rounded-xl" />
        <View className="h-8 w-16 bg-slate-100 rounded-xl" />
      </View>
    </View>
  );
}

// ── Filters ──────────────────────────────────────────────────────────────────

type Filters = SongFilterState & { sortBy: SortBy };

function emptyFilters(): Filters {
  return { sortBy: 'popularity', ...emptyFilterDimensions() };
}


// ── Helpers ───────────────────────────────────────────────────────────────────

function applySort(songs: SongMeta[], sortBy: SortBy): SongMeta[] {
  if (sortBy === 'title_asc') return [...songs].sort((a, b) => a.title.localeCompare(b.title));
  if (sortBy === 'title_desc') return [...songs].sort((a, b) => b.title.localeCompare(a.title));
  return [...songs].sort((a, b) => b.popularity - a.popularity || a.title.localeCompare(b.title));
}

// browse_songs and search_songs return the same column names, so one mapper
// serves both. Notably they derive youtube_id / spotify_track_id from the media
// URLs in SQL — a raw `songs` select cannot produce them.
function toSongMeta(r: any): SongMeta {
  return {
    song_id: r.song_id,
    title: r.title ?? '',
    display_artist: r.display_artist ?? null,
    first_line: r.first_line ?? null,
    slug: r.slug ?? null,
    youtube_id: r.youtube_id ?? null,
    spotify_track_id: r.spotify_track_id ?? null,
    composers: r.composers ?? [],
    productions: r.productions ?? [],
    popularity: Number(r.popularity ?? 0),
    genres: r.genres ?? [],
    cultures: r.cultures ?? [],
    languages: r.languages ?? [],
    themes: r.themes ?? [],
    vibe: r.vibe ?? null,
    tonality: r.tonality ?? null,
    meter: r.meter ?? null,
    year: r.year ?? null,
  };
}

const CATALOG_PAGE = 200; // browse_songs caps p_limit at 200 server-side

// The catalog comes from browse_songs — the same RPC web /search browses — so
// popularity and the media ids have a single source instead of being re-derived
// here. Not fetchAllRows: that walks pages sequentially, and at 200 rows a page
// six serial round-trips of full-catalog work measured ~3x slower than the old
// raw select. The first page reports total_count, so the rest are fanned out in
// parallel (~310-560ms for 1056 rows). browse_songs orders by `title asc, id asc`,
// so page boundaries are stable; errors throw rather than truncating the list,
// and the dedupe by song_id absorbs a concurrent insert shifting the offsets.
async function fetchCatalog(): Promise<SongMeta[]> {
  async function page(offset: number): Promise<any[]> {
    const { data, error } = await supabase.rpc('browse_songs', {
      p_sort: 'title_asc',
      p_offset: offset,
      p_limit: CATALOG_PAGE,
    });
    if (error) throw error;
    return (data ?? []) as any[];
  }

  const first = await page(0);
  const total = Number(first[0]?.total_count ?? first.length);

  const offsets: number[] = [];
  for (let o = CATALOG_PAGE; o < total; o += CATALOG_PAGE) offsets.push(o);
  const rest = await Promise.all(offsets.map(page));

  const byId = new Map<string, any>();
  for (const row of [first, ...rest].flat()) byId.set(row.song_id, row);
  return Array.from(byId.values(), toSongMeta);
}

function showOptionsSheet(title: string, labels: string[], onPick: (index: number) => void) {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: [...labels, 'Cancel'], cancelButtonIndex: labels.length, title },
      (index) => { if (index < labels.length) onPick(index); }
    );
  } else {
    Alert.alert(title, undefined, [
      ...labels.map((label, i) => ({ text: label, onPress: () => onPick(i) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function SongLibraryScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [allSongs, setAllSongs] = useState<SongMeta[]>([]);
  const [searchResults, setSearchResults] = useState<SongMeta[]>([]);
  const [myConfidence, setMyConfidence] = useState<Map<string, string>>(new Map());
  const [loadingAll, setLoadingAll] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [singingVoice, setSingingVoice] = useState<string | null>(null);
  const canLead = !!singingVoice && singingVoice !== 'none';
  const [filters, setFilters] = useState<Filters>(emptyFilters());
  const [hideMySongs, setHideMySongs] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      const [songs, myRes, profileRes] = await Promise.all([
        fetchCatalog(),
        user
          ? supabase.from('user_songs').select('song_id, confidence').eq('user_id', user.id)
          : Promise.resolve({ data: null }),
        user
          ? supabase.from('profiles').select('singing_voice').eq('id', user.id).single()
          : Promise.resolve({ data: null }),
      ]);

      setMyConfidence(new Map(((myRes.data ?? []) as any[]).map(r => [r.song_id, r.confidence ?? 'learn'])));
      setSingingVoice((profileRes.data as any)?.singing_voice ?? null);
      setAllSongs(songs);
      setLoadingAll(false);
    }
    init().catch(() => setLoadingAll(false));
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    if (!q) { setSearchResults([]); setSearchLoading(false); return; }
    setSearchLoading(true);
    setSubmitOpen(false);
    timer.current = setTimeout(async () => {
      const { data } = await supabase.rpc('search_songs', { q, limit_n: 100 });
      setSearchResults(((data ?? []) as any[]).map(toSongMeta));
      setSearchLoading(false);
    }, 250);
  }, [query]);

  // Derive each filter dimension's options from songs passing the OTHER active
  // filters, so choosing one facet narrows the rest (cascading, like web).
  const options = useMemo(() => {
    const pool = hideMySongs ? allSongs.filter(s => !myConfidence.has(s.song_id)) : allSongs;
    return deriveFilterOptions(pool, filters);
  }, [allSongs, filters, hideMySongs, myConfidence]);

  const yearBounds = useMemo(() => {
    const years = allSongs.map(s => s.year).filter((y): y is number => y != null);
    return years.length ? { min: Math.min(...years), max: Math.max(...years) } : { min: null, max: null };
  }, [allSongs]);

  const displayedSongs = useMemo(() => {
    const base = query.trim() ? searchResults : allSongs;
    const filtered = base.filter(s =>
      (!hideMySongs || !myConfidence.has(s.song_id)) && songMatchesFilters(s, filters)
    );
    return applySort(filtered, filters.sortBy);
  }, [query, allSongs, searchResults, filters, hideMySongs, myConfidence]);

  // Adding and changing the role are the same upsert, exactly as on web.
  async function addSong(song: SongMeta, confidence: string) {
    if (!userId) { router.push('/(auth)/sign-in' as any); return; }
    const previous = myConfidence;
    setMyConfidence(prev => new Map(prev).set(song.song_id, confidence));
    const { error } = await supabase.from('user_songs').upsert(
      { user_id: userId, song_id: song.song_id, confidence, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,song_id' }
    );
    if (error) {
      Alert.alert('Error', error.message);
      setMyConfidence(previous);
    }
  }

  const renderItem = useCallback(({ item }: { item: SongMeta }) => (
    <SuggestionCard
      song={item}
      canLead={canLead}
      confidence={myConfidence.get(item.song_id) ?? null}
      onAdd={(confidence) => addSong(item, confidence)}
      onView={() => router.push(`/song/${item.song_id}` as any)}
    />
  ), [myConfidence, canLead, userId]);

  const activeFilterCount = countActiveFilters(filters);
  const sortLabel = SORT_OPTIONS.find(o => o.key === filters.sortBy)?.label ?? 'Popular';
  const searching = query.trim().length > 0;

  const listHeader = (
    <View>
      {/* Search card — mirrors web's bordered search panel */}
      <View className="mx-4 mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <View className="flex-row items-center rounded-xl border border-zinc-200 px-3 py-2">
          <Ionicons name="search" size={16} color="#94a3b8" />
          <TextInput
            className="flex-1 text-slate-900 ml-2"
            placeholder="Search by title, first line, recording artist, or composer"
            placeholderTextColor="#94a3b8"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
        {searching && (
          <Text className="text-xs text-zinc-500 mt-2">
            {searchLoading ? 'Searching…' : `${displayedSongs.length} song(s)`}
          </Text>
        )}
      </View>

      {/* Sort / filters / hide-my-songs, then the catalog total — web's order */}
      <View className="mx-4 mt-3 flex-row items-center px-1" style={{ gap: 8 }}>
        <TouchableOpacity
          onPress={() => showOptionsSheet('Sort', SORT_OPTIONS.map(o => o.label), (index) => setFilters(f => ({ ...f, sortBy: SORT_OPTIONS[index].key })))}
          className="h-7 flex-row items-center gap-1 rounded-lg border border-zinc-200 px-3"
        >
          <Ionicons name="chevron-down" size={11} color="#71717a" />
          <Text className="text-xs font-medium text-zinc-500">{sortLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setFilterModalVisible(true)}
          className={`h-7 flex-row items-center gap-1.5 rounded-lg border px-3 ${
            activeFilterCount > 0 ? 'border-amber-400 bg-amber-50' : 'border-zinc-200'
          }`}
        >
          <Ionicons name="filter" size={12} color={activeFilterCount > 0 ? '#b45309' : '#71717a'} />
          <Text className={`text-xs font-medium ${activeFilterCount > 0 ? 'text-amber-700' : 'text-zinc-500'}`}>
            Filters{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
          </Text>
        </TouchableOpacity>
        {userId && myConfidence.size > 0 && (
          <TouchableOpacity
            onPress={() => setHideMySongs(v => !v)}
            className="h-7 flex-row items-center gap-1.5 rounded-lg border border-zinc-200 px-3"
          >
            <Ionicons
              name={hideMySongs ? 'checkbox' : 'square-outline'}
              size={13}
              color={hideMySongs ? '#d97706' : '#d4d4d8'}
            />
            <Text className="text-xs font-medium text-zinc-500">Hide my songs</Text>
          </TouchableOpacity>
        )}
      </View>
      {!searching && (
        <Text className="mx-4 mt-2 mb-2 px-1 text-xs font-medium text-zinc-400 uppercase tracking-wide">
          {displayedSongs.length} {displayedSongs.length === 1 ? 'song' : 'songs'}
        </Text>
      )}
      {searching && <View className="h-3" />}
    </View>
  );

  // Web keeps its submit-a-song form at the foot of the list; collapsed here
  // because the expanded form is a lot of vertical space for a rare action.
  const listFooter = searching && !searchLoading ? (
    <View className="mx-4 mt-2">
      {submitOpen ? (
        <SubmitMissingSong
          defaultTitle={query.trim()}
          onCreated={(songId) => router.push(`/song/${songId}` as any)}
        />
      ) : (
        <View className="items-center rounded-2xl border border-dashed border-zinc-300 px-4 py-5">
          <Text className="text-sm text-zinc-500">Can't find your song?</Text>
          <TouchableOpacity
            onPress={() => setSubmitOpen(true)}
            className="mt-3 rounded-xl bg-zinc-800 px-4 py-2.5"
          >
            <Text className="text-sm font-semibold text-white">Add a missing song</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  ) : null;

  return (
    <>
      <Stack.Screen options={{ title: 'Song Library', headerTintColor: '#d97706' }} />
      <SongFilterSheet
        visible={filterModalVisible}
        filters={filters}
        options={options}
        yearBounds={yearBounds}
        onChange={setFilters}
        onClose={() => setFilterModalVisible(false)}
      />
      <ContentContainer style={{ backgroundColor: '#f8fafc' }}>
      <KeyboardAvoidingView className="flex-1 bg-slate-50" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {loadingAll ? (
          <View className="pt-4">
            <View className="mx-4 h-20 rounded-2xl border border-zinc-200 bg-white mb-3" />
            {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
          </View>
        ) : (
          <FlatList
            data={displayedSongs}
            keyExtractor={item => item.song_id}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={listHeader}
            ListFooterComponent={listFooter}
            contentContainerStyle={{ paddingBottom: 32 }}
            ListEmptyComponent={
              searchLoading ? null : (
                <View className="mx-4 rounded-2xl border border-zinc-200 bg-white p-5">
                  <Text className="text-sm text-zinc-600">
                    {!searching
                      ? 'No songs match the selected filters.'
                      : searchResults.length > 0
                        ? 'No results match the active filters.'
                        : 'No songs found.'}
                  </Text>
                  {activeFilterCount > 0 && (
                    <TouchableOpacity onPress={() => setFilters(emptyFilters())} className="mt-3">
                      <Text className="text-amber-600 font-medium text-sm">Clear filters</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )
            }
          />
        )}
      </KeyboardAvoidingView>
      </ContentContainer>
    </>
  );
}
