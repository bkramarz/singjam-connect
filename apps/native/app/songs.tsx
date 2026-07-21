import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  ActivityIndicator, ActionSheetIOS, Alert, Platform,
  KeyboardAvoidingView, Modal, ScrollView,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatComposers, songMatchesFilters, deriveFilterOptions, countActiveFilters as countExtendedFilters } from '@singjam/core';
import { supabase } from '@/lib/supabase';
import ContentContainer from '@/components/ContentContainer';
import SubmitMissingSong from '@/components/SubmitMissingSong';

type SongMeta = {
  song_id: string;
  title: string;
  display_artist: string | null;
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
};

type SortBy = 'popularity' | 'title_asc' | 'title_desc';

const SORT_OPTIONS: { key: SortBy; label: string }[] = [
  { key: 'popularity', label: 'Popular' },
  { key: 'title_asc', label: 'A → Z' },
  { key: 'title_desc', label: 'Z → A' },
];

function SkeletonRow() {
  return (
    <View className="px-4 py-3 border-b border-slate-100">
      <View className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
      <View className="h-3 bg-slate-100 rounded w-1/3" />
    </View>
  );
}

// ── Filter chip ───────────────────────────────────────────────────────────────

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`px-3 py-1.5 rounded-full border mr-2 mb-2 ${selected ? 'bg-amber-500 border-amber-500' : 'bg-white border-slate-200'}`}
    >
      <Text className={`text-sm font-medium ${selected ? 'text-white' : 'text-slate-600'}`}>{label}</Text>
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 mt-4">{title}</Text>
  );
}

// ── Filter modal ──────────────────────────────────────────────────────────────

type Filters = {
  sortBy: SortBy;
  hideMySongs: boolean;
  genres: Set<string>;
  cultures: Set<string>;
  languages: Set<string>;
  themes: Set<string>;
  vibe: string;
  tonality: string;
  meter: string;
  yearMin: string;
  yearMax: string;
};

type FilterDim = 'genres' | 'cultures' | 'languages' | 'themes' | 'vibe' | 'tonality' | 'meter' | 'year';

function emptyFilters(): Filters {
  return {
    sortBy: 'popularity',
    hideMySongs: false,
    genres: new Set(),
    cultures: new Set(),
    languages: new Set(),
    themes: new Set(),
    vibe: '',
    tonality: '',
    meter: '',
    yearMin: '',
    yearMax: '',
  };
}

function countActiveFilters(f: Filters): number {
  return (f.hideMySongs ? 1 : 0) + countExtendedFilters(f);
}

function toggle(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  next.has(value) ? next.delete(value) : next.add(value);
  return next;
}

function FilterModal({
  visible,
  filters,
  options,
  yearBounds,
  onChange,
  onClose,
}: {
  visible: boolean;
  filters: Filters;
  options: {
    genres: string[]; cultures: string[]; languages: string[];
    themes: string[]; vibes: string[]; tonalities: string[]; meters: string[];
  };
  yearBounds: { min: number | null; max: number | null };
  onChange: (f: Filters) => void;
  onClose: () => void;
}) {
  const activeCount = countActiveFilters(filters);

  function set(patch: Partial<Filters>) {
    onChange({ ...filters, ...patch });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center px-4 pt-4 pb-3 border-b border-slate-100">
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text className="text-amber-600 font-medium">Done</Text>
          </TouchableOpacity>
          <Text className="flex-1 text-center font-semibold text-slate-900">Filters</Text>
          <TouchableOpacity
            onPress={() => onChange({ ...emptyFilters(), sortBy: filters.sortBy })}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            disabled={activeCount === 0}
          >
            <Text className={`font-medium ${activeCount > 0 ? 'text-red-500' : 'text-slate-300'}`}>Clear</Text>
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 40 }}>

          {/* Hide my songs */}
          <TouchableOpacity
            onPress={() => set({ hideMySongs: !filters.hideMySongs })}
            className="flex-row items-center justify-between py-3 border-b border-slate-100 mb-2"
          >
            <Text className="text-slate-900 font-medium">Hide my songs</Text>
            <View className={`w-11 h-6 rounded-full ${filters.hideMySongs ? 'bg-amber-500' : 'bg-slate-200'} items-center justify-center`}>
              <View className={`w-5 h-5 rounded-full bg-white shadow-sm absolute ${filters.hideMySongs ? 'right-0.5' : 'left-0.5'}`} />
            </View>
          </TouchableOpacity>

          {/* Genre */}
          {options.genres.length > 0 && (
            <>
              <SectionHeader title="Genre" />
              <View className="flex-row flex-wrap">
                {options.genres.map(g => (
                  <Chip key={g} label={g} selected={filters.genres.has(g)} onPress={() => set({ genres: toggle(filters.genres, g) })} />
                ))}
              </View>
            </>
          )}

          {/* Culture */}
          {options.cultures.length > 0 && (
            <>
              <SectionHeader title="Culture" />
              <View className="flex-row flex-wrap">
                {options.cultures.map(c => (
                  <Chip key={c} label={c} selected={filters.cultures.has(c)} onPress={() => set({ cultures: toggle(filters.cultures, c) })} />
                ))}
              </View>
            </>
          )}

          {/* Language */}
          {options.languages.length > 0 && (
            <>
              <SectionHeader title="Language" />
              <View className="flex-row flex-wrap">
                {options.languages.map(l => (
                  <Chip key={l} label={l} selected={filters.languages.has(l)} onPress={() => set({ languages: toggle(filters.languages, l) })} />
                ))}
              </View>
            </>
          )}

          {/* Theme */}
          {options.themes.length > 0 && (
            <>
              <SectionHeader title="Theme" />
              <View className="flex-row flex-wrap">
                {options.themes.map(t => (
                  <Chip key={t} label={t} selected={filters.themes.has(t)} onPress={() => set({ themes: toggle(filters.themes, t) })} />
                ))}
              </View>
            </>
          )}

          {/* Vibe */}
          {options.vibes.length > 0 && (
            <>
              <SectionHeader title="Vibe" />
              <View className="flex-row flex-wrap">
                {options.vibes.map(v => (
                  <Chip key={v} label={v} selected={filters.vibe === v} onPress={() => set({ vibe: filters.vibe === v ? '' : v })} />
                ))}
              </View>
            </>
          )}

          {/* Tonality */}
          {options.tonalities.length > 0 && (
            <>
              <SectionHeader title="Tonality" />
              <View className="flex-row flex-wrap">
                {options.tonalities.map(t => (
                  <Chip key={t} label={t} selected={filters.tonality === t} onPress={() => set({ tonality: filters.tonality === t ? '' : t })} />
                ))}
              </View>
            </>
          )}

          {/* Meter */}
          {options.meters.length > 0 && (
            <>
              <SectionHeader title="Meter" />
              <View className="flex-row flex-wrap">
                {options.meters.map(m => (
                  <Chip key={m} label={m} selected={filters.meter === m} onPress={() => set({ meter: filters.meter === m ? '' : m })} />
                ))}
              </View>
            </>
          )}

          {/* Year */}
          {yearBounds.min != null && (
            <>
              <SectionHeader title="Year" />
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <TextInput
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                  placeholder={yearBounds.min != null ? String(yearBounds.min) : 'From'}
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  maxLength={4}
                  value={filters.yearMin}
                  onChangeText={t => set({ yearMin: t.replace(/[^0-9]/g, '') })}
                />
                <Text className="text-slate-400">–</Text>
                <TextInput
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                  placeholder={yearBounds.max != null ? String(yearBounds.max) : 'To'}
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  maxLength={4}
                  value={filters.yearMax}
                  onChangeText={t => set({ yearMax: t.replace(/[^0-9]/g, '') })}
                />
              </View>
            </>
          )}

        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Applies every active filter, optionally skipping one dimension. Passing an
// `exclude` dimension is how the filter options cascade: each dimension's option
// list is derived from the songs that pass all the *other* active filters.
function matchesFilters(song: SongMeta, f: Filters, myIds: Set<string>, exclude?: FilterDim): boolean {
  if (f.hideMySongs && myIds.has(song.song_id)) return false;
  return songMatchesFilters(song, f, exclude);
}

function applySort(songs: SongMeta[], sortBy: SortBy): SongMeta[] {
  if (sortBy === 'title_asc') return [...songs].sort((a, b) => a.title.localeCompare(b.title));
  if (sortBy === 'title_desc') return [...songs].sort((a, b) => b.title.localeCompare(a.title));
  return [...songs].sort((a, b) => b.popularity - a.popularity || a.title.localeCompare(b.title));
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
  const [myIds, setMyIds] = useState<Set<string>>(new Set());
  const [loadingAll, setLoadingAll] = useState(true);
  const [searching, setSearching] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [singingVoice, setSingingVoice] = useState<string | null>(null);
  const canLead = !!singingVoice && singingVoice !== 'none';
  const [filters, setFilters] = useState<Filters>(emptyFilters());
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const metaMap = useRef<Map<string, SongMeta>>(new Map());

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      const [songsRes, popularityRes, myRes, profileRes] = await Promise.all([
        supabase.from('songs').select(`
          song_id:id, title, display_artist, vibe, tonality, meter, year:year_written,
          song_composers ( people ( name ) ),
          song_productions ( productions ( name ) ),
          song_genres ( genres ( name ) ),
          song_cultures ( cultures ( name ) ),
          song_languages ( languages ( name ) ),
          song_themes ( themes ( name ) )
        `).order('title').limit(1000),
        supabase.rpc('song_popularity_counts'),
        user
          ? supabase.from('user_songs').select('song_id').eq('user_id', user.id)
          : Promise.resolve({ data: null }),
        user
          ? supabase.from('profiles').select('singing_voice').eq('id', user.id).single()
          : Promise.resolve({ data: null }),
      ]);

      setMyIds(new Set((myRes.data ?? []).map((r: any) => r.song_id)));
      setSingingVoice((profileRes.data as any)?.singing_voice ?? null);

      const countMap = new Map<string, number>(
        ((popularityRes.data ?? []) as { song_id: string; user_count: number }[])
          .map(r => [r.song_id, Number(r.user_count)])
      );

      const songs: SongMeta[] = ((songsRes.data ?? []) as any[]).map(s => ({
        song_id: s.song_id,
        title: s.title ?? '',
        display_artist: s.display_artist ?? null,
        composers: (s.song_composers ?? []).map((x: any) => x.people?.name).filter(Boolean),
        productions: (s.song_productions ?? []).map((x: any) => x.productions?.name).filter(Boolean),
        popularity: countMap.get(s.song_id) ?? 0,
        genres: (s.song_genres ?? []).map((x: any) => x.genres?.name).filter(Boolean),
        cultures: (s.song_cultures ?? []).map((x: any) => x.cultures?.name).filter(Boolean),
        languages: (s.song_languages ?? []).map((x: any) => x.languages?.name).filter(Boolean),
        themes: (s.song_themes ?? []).map((x: any) => x.themes?.name).filter(Boolean),
        vibe: s.vibe ?? null,
        tonality: s.tonality ?? null,
        meter: s.meter ?? null,
        year: s.year ?? null,
      }));

      metaMap.current = new Map(songs.map(s => [s.song_id, s]));
      setAllSongs(songs);
      setLoadingAll(false);
    }
    init();
  }, []);

  // Search via RPC, then merge with metaMap for filter fields
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    if (!q) { setSearchResults([]); return; }
    setSearching(true);
    timer.current = setTimeout(async () => {
      const { data } = await supabase.rpc('search_songs', { q, limit_n: 100 });
      const rows: SongMeta[] = ((data ?? []) as any[]).map(r => {
        const meta = metaMap.current.get(r.song_id);
        return meta ?? {
          song_id: r.song_id,
          title: r.title,
          display_artist: r.display_artist ?? null,
          composers: r.composers ?? [],
          productions: r.productions ?? [],
          popularity: r.popularity ?? 0,
          genres: r.genres ?? [],
          cultures: r.cultures ?? [],
          languages: r.languages ?? [],
          themes: r.themes ?? [],
          vibe: r.vibe ?? null,
          tonality: r.tonality ?? null,
          meter: r.meter ?? null,
          year: r.year ?? null,
        };
      });
      setSearchResults(rows);
      setSearching(false);
    }, 250);
  }, [query]);

  // Derive each filter dimension's options from songs passing the OTHER active
  // filters, so choosing one facet narrows the rest (cascading, like web).
  const options = useMemo(() => {
    const pool = filters.hideMySongs ? allSongs.filter(s => !myIds.has(s.song_id)) : allSongs;
    return deriveFilterOptions(pool, filters);
  }, [allSongs, filters, myIds]);

  const yearBounds = useMemo(() => {
    const years = allSongs.map(s => s.year).filter((y): y is number => y != null);
    return years.length ? { min: Math.min(...years), max: Math.max(...years) } : { min: null, max: null };
  }, [allSongs]);

  const displayedSongs = useMemo(() => {
    const base = query.trim() ? searchResults : allSongs;
    const filtered = base.filter(s => matchesFilters(s, filters, myIds));
    return applySort(filtered, filters.sortBy);
  }, [query, allSongs, searchResults, filters, myIds]);

  async function addSong(song: SongMeta, confidence: string) {
    if (!userId) { router.push('/(auth)/sign-in' as any); return; }
    setPendingId(song.song_id);
    const { error } = await supabase.from('user_songs').upsert(
      { user_id: userId, song_id: song.song_id, confidence, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,song_id' }
    );
    setPendingId(null);
    if (error) { Alert.alert('Error', error.message); return; }
    setMyIds(prev => new Set([...prev, song.song_id]));
  }

  function handleAdd(song: SongMeta) {
    const values = ['lead', 'support', 'learn'];
    // "Lead" is gated on the user being a singer, same rule as the repertoire cards.
    if (Platform.OS === 'ios') {
      const leadLabel = canLead ? 'Lead' : 'Lead (singers only)';
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [leadLabel, 'Support', 'Learn', 'Cancel'],
          cancelButtonIndex: 3,
          title: `Add "${song.title}" as…`,
          disabledButtonIndices: canLead ? [] : [0],
        },
        index => { if (index < 3) addSong(song, values[index]); }
      );
    } else {
      Alert.alert('Add as…', song.title, [
        ...(canLead ? [{ text: 'Lead', onPress: () => addSong(song, 'lead') }] : []),
        { text: 'Support', onPress: () => addSong(song, 'support') },
        { text: 'Learn', onPress: () => addSong(song, 'learn') },
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  }

  const renderItem = useCallback(({ item }: { item: SongMeta }) => {
    const added = myIds.has(item.song_id);
    const pending = pendingId === item.song_id;
    const composersLabel = item.composers.length > 0
      ? formatComposers(item.composers, item.cultures)
      : null;
    return (
      <View className="flex-row items-center px-4 py-3 border-b border-slate-100">
        <TouchableOpacity
          className="flex-1 mr-3"
          onPress={() => router.push(`/song/${item.song_id}` as any)}
          activeOpacity={0.6}
        >
          <Text numberOfLines={2}>
            <Text className="text-slate-900 font-medium">{item.title}</Text>
            {composersLabel ? <Text className="text-slate-400"> ({composersLabel})</Text> : null}
          </Text>
          <Text className="text-slate-400 text-sm mt-0.5" numberOfLines={1}>
            {item.productions.length > 0 ? (
              <>from <Text className="italic">{item.productions.join(', ')}</Text></>
            ) : (
              item.display_artist ?? '—'
            )}
          </Text>
          {item.popularity > 0 && (
            <Text className="text-xs text-zinc-400 mt-0.5">
              {item.popularity} {item.popularity === 1 ? 'jammer' : 'jammers'}
            </Text>
          )}
        </TouchableOpacity>
        {added ? (
          <Text className="text-slate-400 text-sm">Added</Text>
        ) : pending ? (
          <ActivityIndicator size="small" color="#d97706" />
        ) : (
          <TouchableOpacity
            onPress={() => handleAdd(item)}
            className="bg-amber-500 rounded-full px-3 py-1"
          >
            <Text className="text-white text-sm font-medium">Add</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [myIds, pendingId, canLead]);

  const activeFilterCount = countActiveFilters(filters);
  const sortLabel = SORT_OPTIONS.find(o => o.key === filters.sortBy)?.label ?? 'Popular';

  return (
    <>
      <Stack.Screen options={{ title: 'Song Library', headerTintColor: '#d97706' }} />
      <FilterModal
        visible={filterModalVisible}
        filters={filters}
        options={options}
        yearBounds={yearBounds}
        onChange={setFilters}
        onClose={() => setFilterModalVisible(false)}
      />
      <ContentContainer style={{ backgroundColor: 'white' }}>
      <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* Search row */}
        <View className="px-4 py-3 border-b border-slate-100">
          <View className="flex-1 flex-row items-center bg-slate-100 rounded-xl px-3 py-2">
            <Text className="text-slate-400 mr-2">🔍</Text>
            <TextInput
              className="flex-1 text-slate-900"
              placeholder="Search by title, artist, or composer…"
              placeholderTextColor="#94a3b8"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Text className="text-slate-400 ml-2">✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Count / sort / filters toolbar */}
        {!loadingAll && (
          <View className="mx-4 my-3 flex-row items-center justify-between">
            <Text className="text-xs font-medium text-zinc-400 uppercase tracking-wide px-1">
              {query.trim()
                ? searching ? 'Searching…' : `${displayedSongs.length} result${displayedSongs.length === 1 ? '' : 's'}`
                : `${displayedSongs.length} songs`}
            </Text>
            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                onPress={() => showOptionsSheet('Sort', SORT_OPTIONS.map(o => o.label), (index) => setFilters(f => ({ ...f, sortBy: SORT_OPTIONS[index].key })))}
                className="h-7 flex-row items-center gap-1 rounded-lg border border-zinc-200 px-3"
              >
                <Text className="text-xs font-medium text-zinc-500">{sortLabel}</Text>
                <Ionicons name="chevron-down" size={11} color="#71717a" />
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
            </View>
          </View>
        )}

        {loadingAll ? (
          <FlatList
            data={Array(10).fill(null)}
            keyExtractor={(_, i) => String(i)}
            renderItem={() => <SkeletonRow />}
            scrollEnabled={false}
          />
        ) : searching ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#d97706" />
          </View>
        ) : (
          <FlatList
            data={displayedSongs}
            keyExtractor={item => item.song_id}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View className="pt-16">
                <Text className="text-slate-400 text-center">
                  {query.trim() ? 'No songs match your search' : 'No songs match these filters'}
                </Text>
                {activeFilterCount > 0 && (
                  <TouchableOpacity onPress={() => setFilters(emptyFilters())} className="mt-3 items-center">
                    <Text className="text-amber-600 font-medium text-sm">Clear filters</Text>
                  </TouchableOpacity>
                )}
                {query.trim().length > 0 && activeFilterCount === 0 && (
                  <SubmitMissingSong
                    defaultTitle={query.trim()}
                    onCreated={(songId) => router.push(`/song/${songId}` as any)}
                  />
                )}
              </View>
            }
          />
        )}
      </KeyboardAvoidingView>
      </ContentContainer>
    </>
  );
}
