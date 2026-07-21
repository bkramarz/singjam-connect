import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, RefreshControl, Alert, Modal, ScrollView, ActionSheetIOS, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { matchesSearch, mergeSuggestionsById, songMatchesFilters, deriveFilterOptions, countActiveFilters, type UserSong } from '@singjam/core';
import { supabase } from '@/lib/supabase';
import { readCache, writeCache } from '@/lib/cache';
import { useAuth } from '@/lib/auth-context';
import RepertoireCard from '@/components/RepertoireCard';
import SuggestionCard, { type Suggestion } from '@/components/SuggestionCard';
import AddSongModal from '@/components/AddSongModal';
import AddToSetModal from '@/components/AddToSetModal';
import SignInPrompt from '@/components/SignInPrompt';
import BrandHeader from '@/components/BrandHeader';
import ContentContainer from '@/components/ContentContainer';

// ── Types ─────────────────────────────────────────────────────────────────────

type RichUserSong = UserSong & {
  genres: string[];
  languages: string[];
  themes: string[];
  productions: string[];
  vibe: string | null;
  tonality: string | null;
  meter: string | null;
  year: number | null;
  popularity: number;
};

type ConfidenceFilter = 'all' | 'lead' | 'support' | 'learn';
type SortOrder = 'title_asc' | 'title_desc' | 'popularity';

type ExtFilters = {
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

// ── Constants (mirror web repertoire/page.tsx) ────────────────────────────────

const CONFIDENCE_LEVELS: { key: Exclude<ConfidenceFilter, 'all'>; label: string }[] = [
  { key: 'lead', label: 'Lead' },
  { key: 'support', label: 'Support' },
  { key: 'learn', label: 'Learn' },
];

const SORT_OPTIONS: { key: SortOrder; label: string }[] = [
  { key: 'title_asc', label: 'A → Z' },
  { key: 'title_desc', label: 'Z → A' },
  { key: 'popularity', label: 'Popular' },
];

function emptyExtFilters(): ExtFilters {
  return { genres: new Set(), cultures: new Set(), languages: new Set(), themes: new Set(), vibe: '', tonality: '', meter: '', yearMin: '', yearMax: '' };
}

function countExtFilters(f: ExtFilters): number {
  return countActiveFilters(f);
}

function toggleSet(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  next.has(value) ? next.delete(value) : next.add(value);
  return next;
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

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <View className="mx-4 border-x border-b border-zinc-200 bg-white p-4">
      <View className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
      <View className="h-3 bg-slate-100 rounded w-1/2 mb-3" />
      <View className="flex-row gap-2 ml-8">
        <View className="h-8 w-20 bg-slate-100 rounded-xl" />
        <View className="h-8 w-20 bg-slate-100 rounded-xl" />
      </View>
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
  visible, filters, options, yearBounds, onChange, onClose,
}: {
  visible: boolean;
  filters: ExtFilters;
  options: FilterOptions;
  yearBounds: { min: number | null; max: number | null };
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
          {yearBounds.min != null && (
            <>
              <SectionLabel title="Year" />
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <TextInput
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                  placeholder={String(yearBounds.min)}
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
          {options.genres.length === 0 && options.cultures.length === 0 && options.languages.length === 0 && options.themes.length === 0 && yearBounds.min == null && (
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

// Same my_repertoire() RPC web's /repertoire uses (single source of truth per
// the parity rule); its composers union also dedupes writer/lyricist overlap.
async function fetchRichUserSongs(): Promise<RichUserSong[]> {
  const { data, error } = await supabase.rpc('my_repertoire');
  if (error) throw error;

  return ((data ?? []) as any[]).map(row => ({
    song_id: row.song_id,
    slug: row.slug ?? null,
    confidence: row.confidence ?? 'learn',
    updated_at: row.updated_at,
    title: row.title ?? '',
    display_artist: row.display_artist ?? null,
    composers: row.composers ?? [],
    cultures: row.cultures ?? [],
    genres: row.genres ?? [],
    languages: row.languages ?? [],
    themes: row.themes ?? [],
    productions: row.productions ?? [],
    vibe: row.vibe ?? null,
    tonality: row.tonality ?? null,
    meter: row.meter ?? null,
    year: row.year ?? null,
    popularity: Number(row.popularity ?? 0),
  }));
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function RepertoireScreen() {
  const router = useRouter();
  const [songs, setSongs] = useState<RichUserSong[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [singingVoice, setSingingVoice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>('all');
  const [sortBy, setSortBy] = useState<SortOrder>('title_asc');
  const [extFilters, setExtFilters] = useState<ExtFilters>(emptyExtFilters());
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addToSetSongs, setAddToSetSongs] = useState<{ id: string; title: string }[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsOffset, setSuggestionsOffset] = useState(0);
  const [suggestionsHasMore, setSuggestionsHasMore] = useState(true);
  const [suggestionsLoadingMore, setSuggestionsLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  const canLead = !!singingVoice && singingVoice !== 'none';

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    try {
      const [data, profileRes, suggestionsRes] = await Promise.all([
        fetchRichUserSongs(),
        supabase.from('profiles').select('singing_voice').eq('id', user.id).single(),
        supabase.rpc('suggest_songs_for_user', { p_user_id: user.id, p_limit: 20 }),
      ]);
      setSongs(data);
      setSingingVoice(profileRes.data?.singing_voice ?? null);
      const initialSuggestions = (suggestionsRes.data ?? []) as Suggestion[];
      setSuggestions(initialSuggestions);
      setSuggestionsOffset(initialSuggestions.length);
      setSuggestionsHasMore(initialSuggestions.length === 20);
      writeCache('/repertoire', user.id, data);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    // Show the cached repertoire immediately; load() still runs and silently
    // replaces it (mirrors web repertoire/page.tsx's sessionStorage hydrate)
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user.id ?? null;
      if (uid) {
        const cached = await readCache<RichUserSong[]>('/repertoire', uid);
        if (cached) {
          setUserId(uid);
          setSongs(cached);
          setLoading(false);
        }
      }
      load();
    })();
  }, []);

  // Derive each filter dimension's options from songs passing the OTHER active
  // filters, so choosing one facet narrows the rest (cascading, like web).
  const options = useMemo<FilterOptions>(() => deriveFilterOptions(songs, extFilters), [songs, extFilters]);

  const yearBounds = useMemo(() => {
    const years = songs.map(s => s.year).filter((y): y is number => y != null);
    return years.length ? { min: Math.min(...years), max: Math.max(...years) } : { min: null, max: null };
  }, [songs]);

  const filtered = useMemo(() => {
    let result: RichUserSong[] = songs;

    if (query.trim()) {
      result = result.filter(s => matchesSearch([s.title, s.display_artist ?? '', ...s.composers].join(' '), query));
    }
    if (confidenceFilter !== 'all') {
      result = result.filter(s => s.confidence === confidenceFilter);
    }

    result = result.filter(s => songMatchesFilters(s, extFilters));

    if (sortBy === 'title_desc') return [...result].sort((a, b) => b.title.localeCompare(a.title));
    if (sortBy === 'popularity') return [...result].sort((a, b) => b.popularity - a.popularity || a.title.localeCompare(b.title));
    return result;
  }, [songs, query, confidenceFilter, extFilters, sortBy]);

  const existingIds = useMemo(() => new Set(songs.map(s => s.song_id)), [songs]);
  const extFilterCount = countExtFilters(extFilters);
  const allSelected = filtered.length > 0 && filtered.every(s => selectedIds.has(s.song_id));

  async function handleConfidenceChange(songId: string, confidence: string) {
    setSongs(prev => prev.map(s => s.song_id === songId ? { ...s, confidence } : s));
    const { error } = await supabase.from('user_songs').update({ confidence }).eq('user_id', userId).eq('song_id', songId);
    if (error) { Alert.alert('Error', error.message); load(); }
  }

  async function handleRemove(songId: string) {
    setSongs(prev => prev.filter(s => s.song_id !== songId));
    setSelectedIds(prev => { const next = new Set(prev); next.delete(songId); return next; });
    const { error } = await supabase.from('user_songs').delete().eq('user_id', userId).eq('song_id', songId);
    if (error) { Alert.alert('Error', error.message); load(); }
  }

  function handleAdded() { setShowAdd(false); load(); }

  const loadMoreSuggestions = useCallback(async () => {
    if (!suggestionsHasMore || loadingMoreRef.current || !userId) return;
    loadingMoreRef.current = true;
    setSuggestionsLoadingMore(true);
    const { data } = await supabase.rpc('suggest_songs_for_user', {
      p_user_id: userId,
      p_limit: 20,
      p_offset: suggestionsOffset,
    });
    if (data) {
      const page = data as Suggestion[];
      setSuggestions(prev => mergeSuggestionsById(prev, page));
      setSuggestionsOffset(prev => prev + page.length);
      setSuggestionsHasMore(page.length === 20);
    }
    loadingMoreRef.current = false;
    setSuggestionsLoadingMore(false);
  }, [suggestionsHasMore, userId, suggestionsOffset]);

  // Mirrors web's addSong from the suggestions panel: optimistically drop the
  // suggestion and insert it into the repertoire, reverting both on error.
  async function addFromSuggestion(s: Suggestion, confidence: string) {
    if (!userId) return;
    const prevSongs = songs;
    const prevSuggestions = suggestions;
    setSuggestions(prev => prev.filter(x => x.song_id !== s.song_id));
    setSongs(prev => {
      if (prev.find(x => x.song_id === s.song_id)) {
        return prev.map(x => x.song_id === s.song_id ? { ...x, confidence } : x);
      }
      const newSong: RichUserSong = {
        song_id: s.song_id,
        slug: s.slug,
        confidence,
        updated_at: new Date().toISOString(),
        title: s.title,
        display_artist: s.display_artist,
        composers: s.composers,
        cultures: s.cultures,
        genres: s.genres,
        languages: s.languages,
        themes: [],
        productions: s.productions,
        vibe: null,
        tonality: null,
        meter: null,
        year: s.year,
        popularity: s.popularity,
      };
      return [...prev, newSong];
    });
    const { error } = await supabase.from('user_songs').upsert(
      { user_id: userId, song_id: s.song_id, confidence, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,song_id' }
    );
    if (error) {
      Alert.alert('Error', error.message);
      setSongs(prevSongs);
      setSuggestions(prevSuggestions);
    }
  }

  function toggleSelect(songId: string) {
    setSelectedIds(prev => toggleSet(prev, songId));
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(filtered.map(s => s.song_id)));
  }

  // ── Bulk actions (bar mirrors web's amber bulk bar) ──────────────────────────

  function handleBulkAddToSet() {
    const selected = songs.filter(s => selectedIds.has(s.song_id)).map(s => ({ id: s.song_id, title: s.title }));
    setAddToSetSongs(selected);
  }

  function handleBulkConfidence() {
    const ids = Array.from(selectedIds);
    const labels = CONFIDENCE_LEVELS.filter(l => l.key !== 'lead' || canLead).map(l => l.label);
    const values = CONFIDENCE_LEVELS.filter(l => l.key !== 'lead' || canLead).map(l => l.key);
    showOptionsSheet(`Change role for ${ids.length} ${ids.length === 1 ? 'song' : 'songs'}`, labels, async (index) => {
      const confidence = values[index];
      setSongs(prev => prev.map(s => selectedIds.has(s.song_id) ? { ...s, confidence } : s));
      setSelectedIds(new Set());
      for (const songId of ids) {
        await supabase.from('user_songs').update({ confidence }).eq('user_id', userId).eq('song_id', songId);
      }
    });
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
            setSelectedIds(new Set());
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
    ({ item, index }: { item: RichUserSong; index: number }) => (
      <RepertoireCard
        song={{ ...item, productions: item.productions ?? [] }}
        selected={selectedIds.has(item.song_id)}
        canLead={canLead}
        isLast={index === filtered.length - 1}
        onToggleSelect={() => toggleSelect(item.song_id)}
        onConfidenceChange={(confidence) => handleConfidenceChange(item.song_id, confidence)}
        onAddToSet={() => setAddToSetSongs([{ id: item.song_id, title: item.title }])}
        onView={() => router.push(`/song/${item.song_id}` as any)}
        onRemove={() => handleRemove(item.song_id)}
      />
    ),
    [userId, songs, selectedIds, canLead, filtered.length]
  );

  const roleLabel = confidenceFilter === 'all'
    ? 'Any role'
    : CONFIDENCE_LEVELS.find(l => l.key === confidenceFilter)?.label ?? 'Any role';
  const sortLabel = SORT_OPTIONS.find(o => o.key === sortBy)?.label ?? 'A → Z';

  const listHeader = (
    <View>
      {/* Search card — mirrors web's bordered search panel */}
      <View className="mx-4 mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <View className="flex-row items-center bg-white border border-zinc-200 rounded-xl px-3 py-2">
          <Ionicons name="search" size={16} color="#94a3b8" />
          <TextInput
            className="flex-1 text-slate-900 ml-2"
            placeholder="Search by title, songwriter, or artist…"
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
          onPress={() => showOptionsSheet('Role', ['Any role', ...CONFIDENCE_LEVELS.map(l => l.label)], (index) =>
            setConfidenceFilter(index === 0 ? 'all' : CONFIDENCE_LEVELS[index - 1].key)
          )}
          className="flex-row items-center justify-between rounded-xl border border-zinc-300 px-3 py-2 mt-3"
        >
          <Text className="text-sm text-slate-700">{roleLabel}</Text>
          <Ionicons name="chevron-down" size={14} color="#71717a" />
        </TouchableOpacity>
      </View>

      {/* Count / sort / filters toolbar */}
      <View className="mx-4 mt-4 flex-row items-center justify-between">
        <Text className="text-xs font-medium text-zinc-400 uppercase tracking-wide px-1">
          {filtered.length} of {songs.length}
        </Text>
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => showOptionsSheet('Sort', SORT_OPTIONS.map(o => o.label), (index) => setSortBy(SORT_OPTIONS[index].key))}
            className="h-7 flex-row items-center gap-1 rounded-lg border border-zinc-200 px-3"
          >
            <Text className="text-xs font-medium text-zinc-500">{sortLabel}</Text>
            <Ionicons name="chevron-down" size={11} color="#71717a" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilterModalVisible(true)}
            className={`h-7 flex-row items-center gap-1.5 rounded-lg border px-3 ${
              extFilterCount > 0 ? 'border-amber-400 bg-amber-50' : 'border-zinc-200'
            }`}
          >
            <Ionicons name="filter" size={12} color={extFilterCount > 0 ? '#b45309' : '#71717a'} />
            <Text className={`text-xs font-medium ${extFilterCount > 0 ? 'text-amber-700' : 'text-zinc-500'}`}>
              Filters{extFilterCount > 0 ? ` · ${extFilterCount}` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <View className="mx-4 mt-3 flex-row flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Text className="text-sm font-medium text-amber-800">{selectedIds.size} selected</Text>
          <TouchableOpacity onPress={() => setSelectedIds(new Set())}>
            <Text className="text-xs text-amber-700 underline">Deselect all</Text>
          </TouchableOpacity>
          <View className="flex-row items-center gap-2 ml-auto">
            <TouchableOpacity onPress={handleBulkAddToSet} className="rounded-xl border border-zinc-300 bg-white px-2 py-1.5">
              <Text className="text-xs text-slate-700">Add to set…</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleBulkConfidence} className="rounded-xl border border-zinc-300 bg-white px-2 py-1.5">
              <Text className="text-xs text-slate-700">Change role…</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleBulkRemove} className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5">
              <Text className="text-xs text-zinc-500">Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Select all — top row of the list container */}
      {filtered.length > 0 && (
        <View className="mx-4 mt-4 flex-row items-center gap-3 rounded-t-md border border-zinc-200 bg-zinc-50 px-4 py-2">
          <TouchableOpacity onPress={toggleSelectAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons
              name={allSelected ? 'checkbox' : 'square-outline'}
              size={18}
              color={allSelected ? '#d97706' : '#d4d4d8'}
            />
          </TouchableOpacity>
          <Text className="text-xs text-zinc-400">Select all</Text>
        </View>
      )}
    </View>
  );

  // "Songs you might know" — mirrors web's SuggestionsPanel, shown below the
  // list (and below the empty-state card) but hidden while searching.
  const showSuggestions = !query.trim() && suggestions.length > 0;
  const listFooter = showSuggestions ? (
    <View>
      <Text className="mx-4 px-1 mt-6 mb-2 text-sm font-medium text-zinc-500">
        Songs you might know
      </Text>
      {suggestions.map(s => (
        <SuggestionCard
          key={s.song_id}
          song={s}
          canLead={canLead}
          onAdd={(confidence) => addFromSuggestion(s, confidence)}
          onView={() => router.push(`/song/${s.song_id}` as any)}
        />
      ))}
      {suggestionsLoadingMore && (
        <View className="py-3">
          <ActivityIndicator size="small" color="#d97706" />
        </View>
      )}
    </View>
  ) : null;

  const { session, initialised } = useAuth();
  if (initialised && !session) return <SignInPrompt message="Sign in to see your repertoire" />;

  return (
    <View className="flex-1 bg-slate-50">
      <FilterModal
        visible={filterModalVisible}
        filters={extFilters}
        options={options}
        yearBounds={yearBounds}
        onChange={setExtFilters}
        onClose={() => setFilterModalVisible(false)}
      />

      <BrandHeader />

      <ContentContainer>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-3 bg-white border-b border-slate-100">
        <View>
          <Text className="text-2xl font-bold text-slate-900">My Repertoire</Text>
          {!loading && (
            <Text className="text-slate-400 text-sm mt-0.5">
              {songs.length} {songs.length === 1 ? 'song' : 'songs'}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => setShowAdd(true)}
          className="bg-amber-500 rounded-full w-9 h-9 items-center justify-center"
        >
          <Text className="text-white text-xl leading-none font-light">+</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="pt-4">
          <View className="mx-4 h-24 rounded-2xl border border-zinc-200 bg-white mb-4" />
          {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.song_id}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          onEndReached={showSuggestions ? loadMoreSuggestions : undefined}
          onEndReachedThreshold={0.5}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#d97706" />}
          ListEmptyComponent={
            <View className="mx-4 mt-4 rounded-2xl border border-zinc-200 bg-white p-6 items-center">
              {query.trim() || confidenceFilter !== 'all' || extFilterCount > 0 ? (
                <>
                  <Text className="text-sm text-slate-500">No matches.</Text>
                  {extFilterCount > 0 && (
                    <TouchableOpacity onPress={() => setExtFilters(emptyExtFilters())} className="mt-3">
                      <Text className="text-amber-600 font-medium text-sm">Clear filters</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <>
                  <Text className="text-base font-semibold text-zinc-900">Your repertoire is empty</Text>
                  <Text className="mt-1 text-sm text-zinc-500 text-center">
                    Add songs you know and SingJam will match you with musicians who share your repertoire.
                  </Text>
                  <TouchableOpacity onPress={() => setShowAdd(true)} className="mt-4">
                    <Text className="text-amber-600 font-medium">Add your first song</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          }
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}
      </ContentContainer>

      {userId && (
        <AddSongModal
          visible={showAdd}
          userId={userId}
          existingIds={existingIds}
          canLead={canLead}
          onClose={() => setShowAdd(false)}
          onAdded={handleAdded}
        />
      )}

      {addToSetSongs && (
        <AddToSetModal
          visible={!!addToSetSongs}
          songs={addToSetSongs}
          onClose={() => { setAddToSetSongs(null); setSelectedIds(new Set()); }}
        />
      )}
    </View>
  );
}
