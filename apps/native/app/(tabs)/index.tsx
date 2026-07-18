import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, RefreshControl, Alert, Modal, ScrollView, ActionSheetIOS, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { matchesSearch, type UserSong } from '@singjam/core';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import SongRow from '@/components/SongRow';
import AddSongModal from '@/components/AddSongModal';
import AddToSetModal from '@/components/AddToSetModal';
import SignInPrompt from '@/components/SignInPrompt';

// ── Types ─────────────────────────────────────────────────────────────────────

type RichUserSong = UserSong & {
  genres: string[];
  languages: string[];
  themes: string[];
  vibe: string | null;
  tonality: string | null;
  meter: string | null;
  popularity: number;
};

type ConfidenceFilter = 'all' | 'lead' | 'support' | 'learn';
type SortOrder = 'title_asc' | 'title_desc' | 'recent' | 'popular';

type ExtFilters = {
  sortBy: SortOrder;
  genres: Set<string>;
  cultures: Set<string>;
  languages: Set<string>;
  themes: Set<string>;
  vibe: string;
  tonality: string;
  meter: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const CONFIDENCE_CHIPS: { key: ConfidenceFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'lead', label: 'Lead' },
  { key: 'support', label: 'Support' },
  { key: 'learn', label: 'Learn' },
];

const SORT_OPTIONS: { key: SortOrder; label: string }[] = [
  { key: 'title_asc', label: 'A → Z' },
  { key: 'title_desc', label: 'Z → A' },
  { key: 'recent', label: 'Recent' },
  { key: 'popular', label: 'Popular' },
];

function emptyExtFilters(): ExtFilters {
  return { sortBy: 'title_asc', genres: new Set(), cultures: new Set(), languages: new Set(), themes: new Set(), vibe: '', tonality: '', meter: '' };
}

function countExtFilters(f: ExtFilters): number {
  return f.genres.size + f.cultures.size + f.languages.size + f.themes.size + (f.vibe ? 1 : 0) + (f.tonality ? 1 : 0) + (f.meter ? 1 : 0);
}

function toggleSet(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  next.has(value) ? next.delete(value) : next.add(value);
  return next;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <View className="px-4 py-3 border-b border-slate-100">
      <View className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
      <View className="h-3 bg-slate-100 rounded w-1/2" />
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

function SectionLabel({ title }: { title: string }) {
  return <Text className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 mt-4">{title}</Text>;
}

// ── Extended filter modal ─────────────────────────────────────────────────────

type FilterOptions = {
  genres: string[]; cultures: string[]; languages: string[];
  themes: string[]; vibes: string[]; tonalities: string[]; meters: string[];
};

function FilterModal({
  visible, filters, options, onChange, onClose,
}: {
  visible: boolean;
  filters: ExtFilters;
  options: FilterOptions;
  onChange: (f: ExtFilters) => void;
  onClose: () => void;
}) {
  const activeCount = countExtFilters(filters);
  function set(patch: Partial<ExtFilters>) { onChange({ ...filters, ...patch }); }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-white">
        <View className="flex-row items-center px-4 pt-4 pb-3 border-b border-slate-100">
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text className="text-amber-600 font-medium">Done</Text>
          </TouchableOpacity>
          <Text className="flex-1 text-center font-semibold text-slate-900">Filter by…</Text>
          <TouchableOpacity
            onPress={() => onChange(emptyExtFilters())}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            disabled={activeCount === 0}
          >
            <Text className={`font-medium ${activeCount > 0 ? 'text-red-500' : 'text-slate-300'}`}>Clear</Text>
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 40 }}>
          <SectionLabel title="Sort" />
          <View className="flex-row flex-wrap">
            {SORT_OPTIONS.map(opt => (
              <Chip key={opt.key} label={opt.label} selected={filters.sortBy === opt.key} onPress={() => set({ sortBy: opt.key })} />
            ))}
          </View>

          {options.genres.length > 0 && (
            <>
              <SectionLabel title="Genre" />
              <View className="flex-row flex-wrap">
                {options.genres.map(g => <Chip key={g} label={g} selected={filters.genres.has(g)} onPress={() => set({ genres: toggleSet(filters.genres, g) })} />)}
              </View>
            </>
          )}
          {options.cultures.length > 0 && (
            <>
              <SectionLabel title="Culture" />
              <View className="flex-row flex-wrap">
                {options.cultures.map(c => <Chip key={c} label={c} selected={filters.cultures.has(c)} onPress={() => set({ cultures: toggleSet(filters.cultures, c) })} />)}
              </View>
            </>
          )}
          {options.languages.length > 0 && (
            <>
              <SectionLabel title="Language" />
              <View className="flex-row flex-wrap">
                {options.languages.map(l => <Chip key={l} label={l} selected={filters.languages.has(l)} onPress={() => set({ languages: toggleSet(filters.languages, l) })} />)}
              </View>
            </>
          )}
          {options.themes.length > 0 && (
            <>
              <SectionLabel title="Theme" />
              <View className="flex-row flex-wrap">
                {options.themes.map(t => <Chip key={t} label={t} selected={filters.themes.has(t)} onPress={() => set({ themes: toggleSet(filters.themes, t) })} />)}
              </View>
            </>
          )}
          {options.vibes.length > 0 && (
            <>
              <SectionLabel title="Vibe" />
              <View className="flex-row flex-wrap">
                {options.vibes.map(v => <Chip key={v} label={v} selected={filters.vibe === v} onPress={() => set({ vibe: filters.vibe === v ? '' : v })} />)}
              </View>
            </>
          )}
          {options.tonalities.length > 0 && (
            <>
              <SectionLabel title="Tonality" />
              <View className="flex-row flex-wrap">
                {options.tonalities.map(t => <Chip key={t} label={t} selected={filters.tonality === t} onPress={() => set({ tonality: filters.tonality === t ? '' : t })} />)}
              </View>
            </>
          )}
          {options.meters.length > 0 && (
            <>
              <SectionLabel title="Meter" />
              <View className="flex-row flex-wrap">
                {options.meters.map(m => <Chip key={m} label={m} selected={filters.meter === m} onPress={() => set({ meter: filters.meter === m ? '' : m })} />)}
              </View>
            </>
          )}
          {options.genres.length === 0 && options.cultures.length === 0 && options.languages.length === 0 && options.themes.length === 0 && (
            <View className="items-center pt-16">
              <Text className="text-slate-400 text-sm">No filter options available yet.</Text>
              <Text className="text-slate-400 text-sm mt-1">Add more songs to your repertoire.</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function fetchRichUserSongs(userId: string): Promise<RichUserSong[]> {
  const [{ data, error }, { data: popData }] = await Promise.all([
    supabase
      .from('user_songs')
      .select(`
        song_id, confidence, updated_at,
        songs (
          title, slug, display_artist, vibe, tonality, meter,
          song_composers ( people ( name ) ),
          song_lyricists ( people ( name ) ),
          song_cultures ( cultures ( name ) ),
          song_genres ( genres ( name ) ),
          song_languages ( languages ( name ) ),
          song_themes ( themes ( name ) )
        )
      `)
      .eq('user_id', userId)
      .limit(1000),
    supabase.rpc('song_popularity_counts'),
  ]);

  if (error) throw error;

  const popularityMap = new Map<string, number>();
  (popData ?? []).forEach((row: any) => popularityMap.set(row.song_id, Number(row.user_count)));

  return ((data ?? []) as any[])
    .filter(row => row.songs)
    .map(row => ({
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
      genres: row.songs.song_genres?.map((g: any) => g.genres?.name).filter(Boolean) ?? [],
      languages: row.songs.song_languages?.map((l: any) => l.languages?.name).filter(Boolean) ?? [],
      themes: row.songs.song_themes?.map((t: any) => t.themes?.name).filter(Boolean) ?? [],
      vibe: row.songs.vibe ?? null,
      tonality: row.songs.tonality ?? null,
      meter: row.songs.meter ?? null,
      popularity: popularityMap.get(row.song_id) ?? 0,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function RepertoireScreen() {
  const router = useRouter();
  const [songs, setSongs] = useState<RichUserSong[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>('all');
  const [extFilters, setExtFilters] = useState<ExtFilters>(emptyExtFilters());
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addToSetSongs, setAddToSetSongs] = useState<{ id: string; title: string }[] | null>(null);

  // Bulk selection
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    try {
      const data = await fetchRichUserSongs(user.id);
      setSongs(data);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Derive filter option lists from the user's own songs
  const options = useMemo<FilterOptions>(() => ({
    genres: Array.from(new Set(songs.flatMap(s => s.genres))).sort(),
    cultures: Array.from(new Set(songs.flatMap(s => s.cultures))).sort(),
    languages: Array.from(new Set(songs.flatMap(s => s.languages))).sort(),
    themes: Array.from(new Set(songs.flatMap(s => s.themes))).sort(),
    vibes: Array.from(new Set(songs.map(s => s.vibe).filter(Boolean) as string[])).sort(),
    tonalities: Array.from(new Set(songs.flatMap(s => s.tonality ? s.tonality.split(/,\s*/) : []))).sort(),
    meters: Array.from(new Set(songs.map(s => s.meter).filter(Boolean) as string[])).sort(),
  }), [songs]);

  const filtered = useMemo(() => {
    let result: RichUserSong[] = songs;

    if (query.trim()) {
      result = result.filter(s => matchesSearch([s.title, s.display_artist ?? ''].join(' '), query));
    }
    if (confidenceFilter !== 'all') {
      result = result.filter(s => s.confidence === confidenceFilter);
    }

    // Extended filters
    if (extFilters.genres.size > 0) result = result.filter(s => s.genres.some(g => extFilters.genres.has(g)));
    if (extFilters.cultures.size > 0) result = result.filter(s => s.cultures.some(c => extFilters.cultures.has(c)));
    if (extFilters.languages.size > 0) result = result.filter(s => s.languages.some(l => extFilters.languages.has(l)));
    if (extFilters.themes.size > 0) result = result.filter(s => s.themes.some(t => extFilters.themes.has(t)));
    if (extFilters.vibe) result = result.filter(s => s.vibe === extFilters.vibe);
    if (extFilters.tonality) result = result.filter(s => s.tonality?.split(/,\s*/).includes(extFilters.tonality));
    if (extFilters.meter) result = result.filter(s => s.meter === extFilters.meter);

    // Sort
    if (extFilters.sortBy === 'title_desc') return [...result].sort((a, b) => b.title.localeCompare(a.title));
    if (extFilters.sortBy === 'recent') return [...result].sort((a, b) => {
      if (!a.updated_at && !b.updated_at) return 0;
      if (!a.updated_at) return 1;
      if (!b.updated_at) return -1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
    if (extFilters.sortBy === 'popular') return [...result].sort((a, b) => b.popularity - a.popularity);
    return result;
  }, [songs, query, confidenceFilter, extFilters]);

  const existingIds = useMemo(() => new Set(songs.map(s => s.song_id)), [songs]);
  const extFilterCount = countExtFilters(extFilters);

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  async function handleConfidenceChange(songId: string, confidence: string) {
    setSongs(prev => prev.map(s => s.song_id === songId ? { ...s, confidence } : s));
    const { error } = await supabase.from('user_songs').update({ confidence }).eq('user_id', userId).eq('song_id', songId);
    if (error) { Alert.alert('Error', error.message); load(); }
  }

  async function handleRemove(songId: string) {
    setSongs(prev => prev.filter(s => s.song_id !== songId));
    const { error } = await supabase.from('user_songs').delete().eq('user_id', userId).eq('song_id', songId);
    if (error) { Alert.alert('Error', error.message); load(); }
  }

  function handleAdded() { setShowAdd(false); load(); }

  function handleAddToSet(songId: string) {
    const song = songs.find(s => s.song_id === songId);
    setAddToSetSongs([{ id: songId, title: song?.title ?? '' }]);
  }

  // ── Bulk actions ─────────────────────────────────────────────────────────────

  function handleBulkAddToSet() {
    const selected = songs.filter(s => selectedIds.has(s.song_id)).map(s => ({ id: s.song_id, title: s.title }));
    setAddToSetSongs(selected);
    exitSelectMode();
  }

  function handleBulkConfidence() {
    const ids = Array.from(selectedIds);
    const options = ['Lead', 'Support', 'Learn', 'Cancel'];
    const values = ['lead', 'support', 'learn'];

    const apply = async (confidence: string) => {
      setSongs(prev => prev.map(s => selectedIds.has(s.song_id) ? { ...s, confidence } : s));
      exitSelectMode();
      for (const songId of ids) {
        await supabase.from('user_songs').update({ confidence }).eq('user_id', userId).eq('song_id', songId);
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 3, title: `Change level for ${ids.length} songs` },
        (index) => { if (index < 3) apply(values[index]); }
      );
    } else {
      Alert.alert(`Change level for ${ids.length} songs`, undefined, [
        { text: 'Lead', onPress: () => apply('lead') },
        { text: 'Support', onPress: () => apply('support') },
        { text: 'Learn', onPress: () => apply('learn') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  function handleBulkRemove() {
    const ids = Array.from(selectedIds);
    Alert.alert(
      'Remove songs',
      `Remove ${ids.length} ${ids.length === 1 ? 'song' : 'songs'} from your repertoire?`,
      [
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setSongs(prev => prev.filter(s => !selectedIds.has(s.song_id)));
            exitSelectMode();
            for (const songId of ids) {
              await supabase.from('user_songs').delete().eq('user_id', userId).eq('song_id', songId);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }

  const renderItem = useCallback(
    ({ item }: { item: RichUserSong }) => (
      <SongRow
        song={item}
        onConfidenceChange={handleConfidenceChange}
        onRemove={handleRemove}
        onAddToSet={handleAddToSet}
        onPress={!selectMode && item.song_id ? () => router.push(`/song/${item.song_id}` as any) : undefined}
        bulkMode={selectMode}
        selected={selectedIds.has(item.song_id)}
        onToggle={() => setSelectedIds(prev => {
          const next = new Set(prev);
          next.has(item.song_id) ? next.delete(item.song_id) : next.add(item.song_id);
          return next;
        })}
      />
    ),
    [userId, songs, selectMode, selectedIds]
  );

  const { session, initialised } = useAuth();
  if (initialised && !session) return <SignInPrompt message="Sign in to see your repertoire" />;

  return (
    <View className="flex-1 bg-white">
      <FilterModal
        visible={filterModalVisible}
        filters={extFilters}
        options={options}
        onChange={setExtFilters}
        onClose={() => setFilterModalVisible(false)}
      />

      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-14 pb-3 border-b border-slate-100">
        {selectMode ? (
          <>
            <TouchableOpacity onPress={exitSelectMode} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text className="text-amber-600 font-medium">Cancel</Text>
            </TouchableOpacity>
            <Text className="text-base font-semibold text-slate-900">
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select songs'}
            </Text>
            <TouchableOpacity
              onPress={() => setSelectedIds(new Set(filtered.map(s => s.song_id)))}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text className="text-amber-600 font-medium">All</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View>
              <Text className="text-2xl font-bold text-slate-900">My Repertoire</Text>
              {!loading && (
                <Text className="text-slate-400 text-sm mt-0.5">
                  {songs.length} {songs.length === 1 ? 'song' : 'songs'}
                </Text>
              )}
            </View>
            <View className="flex-row items-center gap-3">
              {songs.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSelectMode(true)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text className="text-amber-600 font-medium text-sm">Select</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => router.push('/songs' as any)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="search" size={22} color="#94a3b8" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowAdd(true)}
                className="bg-amber-500 rounded-full w-9 h-9 items-center justify-center"
              >
                <Text className="text-white text-xl leading-none font-light">+</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Search + filter icon — hidden in select mode */}
      {!selectMode && (
        <View className="px-4 pt-2 pb-1 border-b border-slate-100">
          <View className="flex-row items-center gap-2 mb-2">
            <View className="flex-1 flex-row items-center bg-slate-100 rounded-xl px-3 py-2">
              <Text className="text-slate-400 mr-2">🔍</Text>
              <TextInput
                className="flex-1 text-slate-900"
                placeholder="Search your repertoire…"
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
            <TouchableOpacity
              onPress={() => setFilterModalVisible(true)}
              className="relative"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="options-outline" size={22} color={extFilterCount > 0 ? '#d97706' : '#64748b'} />
              {extFilterCount > 0 && (
                <View className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 items-center justify-center">
                  <Text className="text-white text-xs font-bold leading-none">{extFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Confidence chips */}
          <View className="flex-row gap-2 pb-1 mb-1">
            {CONFIDENCE_CHIPS.map(chip => (
              <TouchableOpacity
                key={chip.key}
                onPress={() => setConfidenceFilter(chip.key)}
                className={`px-3 py-1 rounded-full border ${confidenceFilter === chip.key ? 'bg-amber-500 border-amber-500' : 'bg-white border-slate-200'}`}
              >
                <Text className={`text-sm font-medium ${confidenceFilter === chip.key ? 'text-white' : 'text-slate-600'}`}>{chip.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* List */}
      {loading ? (
        <FlatList
          data={Array(8).fill(null)}
          keyExtractor={(_, i) => String(i)}
          renderItem={() => <SkeletonRow />}
          scrollEnabled={false}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.song_id}
          renderItem={renderItem}
          refreshControl={!selectMode ? <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#d97706" /> : undefined}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center pt-24">
              <Text className="text-slate-400 text-base">
                {query.trim() || confidenceFilter !== 'all' || extFilterCount > 0
                  ? 'No songs match these filters'
                  : 'Your repertoire is empty'}
              </Text>
              {!query.trim() && confidenceFilter === 'all' && extFilterCount === 0 ? (
                <TouchableOpacity onPress={() => setShowAdd(true)} className="mt-4">
                  <Text className="text-amber-600 font-medium">Add your first song</Text>
                </TouchableOpacity>
              ) : extFilterCount > 0 ? (
                <TouchableOpacity onPress={() => setExtFilters(emptyExtFilters())} className="mt-3">
                  <Text className="text-amber-600 font-medium text-sm">Clear filters</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
          contentContainerStyle={selectMode && selectedIds.size > 0 ? { paddingBottom: 100 } : undefined}
        />
      )}

      {/* Bulk action bar */}
      {selectMode && selectedIds.size > 0 && (
        <View className="absolute bottom-0 left-0 right-0 px-4 pb-8 pt-3 bg-white border-t border-slate-100 flex-row gap-2">
          <TouchableOpacity
            onPress={handleBulkAddToSet}
            className="flex-1 py-2.5 rounded-xl border border-amber-400 items-center"
          >
            <Text className="text-amber-600 text-sm font-semibold">Add to set</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleBulkConfidence}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 items-center"
          >
            <Text className="text-slate-700 text-sm font-semibold">Change level</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleBulkRemove}
            className="flex-1 py-2.5 rounded-xl border border-red-200 items-center"
          >
            <Text className="text-red-500 text-sm font-semibold">Remove</Text>
          </TouchableOpacity>
        </View>
      )}

      {userId && (
        <AddSongModal
          visible={showAdd}
          userId={userId}
          existingIds={existingIds}
          onClose={() => setShowAdd(false)}
          onAdded={handleAdded}
        />
      )}

      {addToSetSongs && (
        <AddToSetModal
          visible={!!addToSetSongs}
          songs={addToSetSongs}
          onClose={() => setAddToSetSongs(null)}
        />
      )}
    </View>
  );
}
