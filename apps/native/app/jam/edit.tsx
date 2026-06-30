import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, Modal, FlatList, Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

const PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

type LookupItem = { id: string; name: string };
type PlaceSuggestion = { description: string; neighborhood: string; placeId: string };

const VISIBILITY_OPTIONS: { value: 'community' | 'private'; label: string }[] = [
  { value: 'community', label: 'Community' },
  { value: 'private', label: 'Private' },
];

// ── Location modal ────────────────────────────────────────────────────────────

function LocationModal({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (address: string, neighborhood: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) { setQuery(''); setSuggestions([]); }
  }, [visible]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 2) { setSuggestions([]); return; }
    timer.current = setTimeout(() => fetchSuggestions(query.trim()), 300);
  }, [query]);

  async function fetchSuggestions(q: string) {
    setSearching(true);
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&key=${PLACES_KEY}&language=en`;
      const res = await fetch(url);
      const json = await res.json();
      setSuggestions(
        (json.predictions ?? []).map((p: any) => ({
          description: p.description,
          neighborhood: p.terms?.[0]?.value ?? p.description,
          placeId: p.place_id,
        }))
      );
    } catch {
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View className="flex-row items-center px-4 pt-4 pb-2 border-b border-slate-100">
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text className="text-amber-600 font-medium">Cancel</Text>
          </TouchableOpacity>
          <Text className="flex-1 text-center font-semibold text-slate-900">Location</Text>
          <View style={{ width: 54 }} />
        </View>
        <View className="px-4 py-3 border-b border-slate-100">
          <View className="flex-row items-center bg-slate-100 rounded-xl px-3 py-2">
            <Ionicons name="search" size={14} color="#94a3b8" style={{ marginRight: 6 }} />
            <TextInput
              className="flex-1 text-slate-900"
              placeholder="Search venue, address, or city…"
              placeholderTextColor="#94a3b8"
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(''); setSuggestions([]); }}>
                <Ionicons name="close-circle" size={16} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
        </View>
        {searching ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#d97706" />
          </View>
        ) : (
          <FlatList
            data={suggestions}
            keyExtractor={item => item.placeId}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => { onSelect(item.description, item.neighborhood); onClose(); }}
                className="px-4 py-3 border-b border-slate-100"
              >
                <Text className="text-slate-900" numberOfLines={2}>📍 {item.description}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              query.length >= 2 ? (
                <View className="items-center pt-12">
                  <Text className="text-slate-400">No results</Text>
                </View>
              ) : null
            }
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Genre/Theme multi-select modal ────────────────────────────────────────────

function MultiSelectModal({
  visible,
  title,
  items,
  selected,
  onClose,
  onToggle,
}: {
  visible: boolean;
  title: string;
  items: LookupItem[];
  selected: string[];
  onClose: () => void;
  onToggle: (id: string) => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-white">
        <View className="flex-row items-center px-4 pt-4 pb-3 border-b border-slate-100">
          <View style={{ width: 48 }} />
          <Text className="flex-1 text-center font-semibold text-slate-900">{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text className="text-amber-600 font-medium">Done</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const checked = selected.includes(item.id);
            return (
              <TouchableOpacity
                onPress={() => onToggle(item.id)}
                className={`px-4 py-3 border-b border-slate-100 flex-row items-center justify-between ${checked ? 'bg-amber-50' : ''}`}
              >
                <Text className={`${checked ? 'text-amber-800 font-semibold' : 'text-slate-900'}`}>{item.name}</Text>
                {checked && <Ionicons name="checkmark" size={16} color="#d97706" />}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateDisplay(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTimeDisplay(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function isoToDate(iso: string | null): Date {
  return iso ? new Date(iso) : new Date();
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function EditJamScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loadingJam, setLoadingJam] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'community' | 'private'>('community');
  const [capacity, setCapacity] = useState('');
  const [guestsCanInvite, setGuestsCanInvite] = useState(false);

  const [date, setDate] = useState<Date>(new Date());
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [locationTbd, setLocationTbd] = useState(false);
  const [fullAddress, setFullAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState('');

  const [genres, setGenres] = useState<LookupItem[]>([]);
  const [themes, setThemes] = useState<LookupItem[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);

  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [startPickerVisible, setStartPickerVisible] = useState(false);
  const [endPickerVisible, setEndPickerVisible] = useState(false);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [genreModalVisible, setGenreModalVisible] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    async function load() {
      const [jamResult, genreResult, themeResult, jamGenresResult, jamThemesResult] = await Promise.all([
        supabase.from('jams').select('*').eq('id', id).single(),
        supabase.from('genres').select('id, name').order('name'),
        supabase.from('themes').select('id, name').order('name'),
        supabase.from('jam_genres').select('genre_id').eq('jam_id', id),
        supabase.from('jam_themes').select('theme_id').eq('jam_id', id),
      ]);

      if (!jamResult.data) { setNotFound(true); setLoadingJam(false); return; }

      const j = jamResult.data as any;
      setName(j.name ?? '');
      setDescription(j.notes ?? '');
      setVisibility(j.visibility === 'private' ? 'private' : 'community');
      setCapacity(j.capacity?.toString() ?? '');
      setGuestsCanInvite(j.guests_can_invite ?? false);

      const startsAt = j.starts_at ? new Date(j.starts_at) : new Date();
      const endsAt = j.ends_at ? new Date(j.ends_at) : null;
      setDate(startsAt);
      setStartTime(startsAt);
      setEndTime(endsAt);

      const isTbd = j.neighborhood === 'TBD' && !j.full_address;
      setLocationTbd(isTbd);
      setFullAddress(isTbd ? '' : (j.full_address ?? j.neighborhood ?? ''));
      setNeighborhood(isTbd ? '' : (j.neighborhood ?? ''));

      setGenres((genreResult.data as LookupItem[]) ?? []);
      setThemes((themeResult.data as LookupItem[]) ?? []);
      setSelectedGenres((jamGenresResult.data ?? []).map((r: any) => r.genre_id));
      setSelectedThemes((jamThemesResult.data ?? []).map((r: any) => r.theme_id));
      setLoadingJam(false);
    }
    load();
  }, [id]);

  function toggleGenre(itemId: string) {
    setSelectedGenres(prev => prev.includes(itemId) ? prev.filter(x => x !== itemId) : [...prev, itemId]);
  }

  function toggleTheme(itemId: string) {
    setSelectedThemes(prev => prev.includes(itemId) ? prev.filter(x => x !== itemId) : [...prev, itemId]);
  }

  function buildStartsAt(): string {
    const d = new Date(date);
    d.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
    return d.toISOString();
  }

  function buildEndsAt(): string | null {
    if (!endTime) return null;
    const d = new Date(date);
    d.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
    return d.toISOString();
  }

  async function handleSave() {
    setError(null);
    if (!locationTbd && !fullAddress) { setError('Add a location or mark it as TBD.'); return; }

    setSaving(true);
    const { error: updateError } = await supabase.from('jams').update({
      name: name.trim() || null,
      starts_at: buildStartsAt(),
      ends_at: buildEndsAt(),
      neighborhood: locationTbd ? 'TBD' : (neighborhood || fullAddress || null),
      full_address: locationTbd ? null : (fullAddress || null),
      notes: description.trim() || null,
      visibility,
      guests_can_invite: guestsCanInvite,
      capacity: capacity ? parseInt(capacity, 10) : null,
    }).eq('id', id);

    if (updateError) { setError(updateError.message); setSaving(false); return; }

    await Promise.all([
      supabase.from('jam_genres').delete().eq('jam_id', id),
      supabase.from('jam_themes').delete().eq('jam_id', id),
    ]);

    await Promise.all([
      selectedGenres.length > 0
        ? supabase.from('jam_genres').insert(selectedGenres.map(genre_id => ({ jam_id: id, genre_id })))
        : Promise.resolve(),
      selectedThemes.length > 0
        ? supabase.from('jam_themes').insert(selectedThemes.map(theme_id => ({ jam_id: id, theme_id })))
        : Promise.resolve(),
    ]);

    setSaving(false);
    router.back();
  }

  async function handleDelete() {
    Alert.alert('Delete Jam', 'This will permanently delete this jam and all RSVPs. This cannot be undone.', [
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('jams').delete().eq('id', id);
          router.replace('/(tabs)/jams' as any);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  const selectedGenreNames = selectedGenres.map(gid => genres.find(g => g.id === gid)?.name).filter(Boolean).join(', ');
  const selectedThemeNames = selectedThemes.map(tid => themes.find(t => t.id === tid)?.name).filter(Boolean).join(', ');

  if (loadingJam) {
    return (
      <>
        <Stack.Screen options={{ title: 'Edit Jam', headerTintColor: '#d97706' }} />
        <View className="flex-1 bg-white items-center justify-center">
          <ActivityIndicator color="#d97706" />
        </View>
      </>
    );
  }

  if (notFound) {
    return (
      <>
        <Stack.Screen options={{ title: 'Edit Jam', headerTintColor: '#d97706' }} />
        <View className="flex-1 bg-white items-center justify-center">
          <Text className="text-slate-400">Jam not found</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Edit Jam', headerTintColor: '#d97706' }} />

      <LocationModal
        visible={locationModalVisible}
        onClose={() => setLocationModalVisible(false)}
        onSelect={(addr, nbhd) => { setFullAddress(addr); setNeighborhood(nbhd); }}
      />
      <MultiSelectModal
        visible={genreModalVisible}
        title="Genres"
        items={genres}
        selected={selectedGenres}
        onClose={() => setGenreModalVisible(false)}
        onToggle={toggleGenre}
      />
      <MultiSelectModal
        visible={themeModalVisible}
        title="Themes"
        items={themes}
        selected={selectedThemes}
        onClose={() => setThemeModalVisible(false)}
        onToggle={toggleTheme}
      />

      {datePickerVisible && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setDatePickerVisible(false)}>
          <View className="flex-1 bg-black/40 justify-end">
            <View className="bg-white pb-6">
              <View className="flex-row justify-end px-4 pt-3 pb-1">
                <TouchableOpacity onPress={() => setDatePickerVisible(false)}>
                  <Text className="text-amber-600 font-semibold text-base">Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker value={date} mode="date" display="spinner" onChange={(_, d) => { if (d) setDate(d); }} />
            </View>
          </View>
        </Modal>
      )}

      {startPickerVisible && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setStartPickerVisible(false)}>
          <View className="flex-1 bg-black/40 justify-end">
            <View className="bg-white pb-6">
              <View className="flex-row justify-end px-4 pt-3 pb-1">
                <TouchableOpacity onPress={() => setStartPickerVisible(false)}>
                  <Text className="text-amber-600 font-semibold text-base">Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker value={startTime} mode="time" display="spinner" onChange={(_, d) => { if (d) setStartTime(d); }} minuteInterval={5} />
            </View>
          </View>
        </Modal>
      )}

      {endPickerVisible && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setEndPickerVisible(false)}>
          <View className="flex-1 bg-black/40 justify-end">
            <View className="bg-white pb-6">
              <View className="flex-row items-center justify-between px-4 pt-3 pb-1">
                <TouchableOpacity onPress={() => { setEndTime(null); setEndPickerVisible(false); }}>
                  <Text className="text-slate-400 font-medium">Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setEndPickerVisible(false)}>
                  <Text className="text-amber-600 font-semibold text-base">Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker value={endTime ?? startTime} mode="time" display="spinner" onChange={(_, d) => { if (d) setEndTime(d); }} minuteInterval={5} />
            </View>
          </View>
        </Modal>
      )}

      <KeyboardAvoidingView
        className="flex-1 bg-slate-50"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
          <View className="px-4 pt-4 pb-16">

            {/* Name */}
            <View className="bg-white rounded-xl border border-slate-100 overflow-hidden mb-4">
              <View className="px-4 py-3 border-b border-slate-100">
                <Text className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Name</Text>
                <TextInput
                  className="text-slate-900 text-base"
                  placeholder="Leave blank for auto-name"
                  placeholderTextColor="#94a3b8"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="sentences"
                />
              </View>
              <View className="px-4 py-3">
                <Text className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Notes (optional)</Text>
                <TextInput
                  className="text-slate-900"
                  placeholder="What to bring, parking info, song suggestions…"
                  placeholderTextColor="#94a3b8"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  style={{ minHeight: 60, textAlignVertical: 'top' }}
                  autoCapitalize="sentences"
                />
              </View>
            </View>

            {/* Date & Time */}
            <View className="bg-white rounded-xl border border-slate-100 overflow-hidden mb-4">
              <TouchableOpacity
                onPress={() => setDatePickerVisible(true)}
                className="px-4 py-3 border-b border-slate-100 flex-row items-center justify-between"
              >
                <Text className="text-xs font-semibold uppercase tracking-widest text-slate-400">Date</Text>
                <Text className="text-slate-900 font-medium">{formatDateDisplay(date)}</Text>
              </TouchableOpacity>
              <View className="flex-row">
                <TouchableOpacity
                  onPress={() => setStartPickerVisible(true)}
                  className="flex-1 px-4 py-3 border-r border-slate-100 flex-row items-center justify-between"
                >
                  <Text className="text-xs font-semibold uppercase tracking-widest text-slate-400">Start</Text>
                  <Text className="text-slate-900 font-medium">{formatTimeDisplay(startTime)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setEndPickerVisible(true)}
                  className="flex-1 px-4 py-3 flex-row items-center justify-between"
                >
                  <Text className="text-xs font-semibold uppercase tracking-widest text-slate-400">End</Text>
                  <Text className={`font-medium ${endTime ? 'text-slate-900' : 'text-slate-400'}`}>
                    {endTime ? formatTimeDisplay(endTime) : 'Optional'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Location */}
            <View className="bg-white rounded-xl border border-slate-100 overflow-hidden mb-4">
              <TouchableOpacity
                onPress={() => { if (!locationTbd) setLocationModalVisible(true); }}
                className="px-4 py-3 border-b border-slate-100 flex-row items-center justify-between"
                disabled={locationTbd}
              >
                <Text className="text-xs font-semibold uppercase tracking-widest text-slate-400">Location</Text>
                <Text className={`font-medium flex-1 text-right ml-4 ${fullAddress && !locationTbd ? 'text-slate-900' : 'text-slate-400'}`} numberOfLines={1}>
                  {locationTbd ? 'TBD' : (fullAddress || 'Tap to search')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setLocationTbd(!locationTbd); if (!locationTbd) { setFullAddress(''); setNeighborhood(''); } }}
                className="px-4 py-3 flex-row items-center gap-3"
              >
                <View className={`w-5 h-5 rounded border-2 items-center justify-center ${locationTbd ? 'bg-amber-500 border-amber-500' : 'border-slate-300'}`}>
                  {locationTbd && <Ionicons name="checkmark" size={12} color="white" />}
                </View>
                <Text className="text-slate-700 text-sm">Location TBD</Text>
              </TouchableOpacity>
            </View>

            {/* Visibility & Settings */}
            <View className="bg-white rounded-xl border border-slate-100 overflow-hidden mb-4">
              <View className="px-4 py-3 border-b border-slate-100">
                <Text className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Visibility</Text>
                <View className="flex-row gap-2">
                  {VISIBILITY_OPTIONS.map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setVisibility(opt.value)}
                      className={`flex-1 rounded-xl py-2.5 items-center border ${visibility === opt.value ? 'bg-amber-500 border-amber-500' : 'bg-white border-slate-200'}`}
                    >
                      <Text className={`text-sm font-semibold ${visibility === opt.value ? 'text-white' : 'text-slate-600'}`}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View className="px-4 py-3 border-b border-slate-100">
                <Text className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Capacity (optional)</Text>
                <TextInput
                  className="text-slate-900"
                  placeholder="No limit"
                  placeholderTextColor="#94a3b8"
                  value={capacity}
                  onChangeText={setCapacity}
                  keyboardType="number-pad"
                />
              </View>
              <TouchableOpacity
                onPress={() => setGuestsCanInvite(!guestsCanInvite)}
                className="px-4 py-3 flex-row items-center gap-3"
              >
                <View className={`w-5 h-5 rounded border-2 items-center justify-center ${guestsCanInvite ? 'bg-amber-500 border-amber-500' : 'border-slate-300'}`}>
                  {guestsCanInvite && <Ionicons name="checkmark" size={12} color="white" />}
                </View>
                <View className="flex-1">
                  <Text className="text-slate-900 font-medium">Guests can invite</Text>
                  <Text className="text-xs text-slate-400">Attendees can invite other members</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Genres & Themes */}
            <View className="bg-white rounded-xl border border-slate-100 overflow-hidden mb-6">
              <TouchableOpacity
                onPress={() => setGenreModalVisible(true)}
                className="px-4 py-3 border-b border-slate-100 flex-row items-center justify-between"
              >
                <Text className="text-xs font-semibold uppercase tracking-widest text-slate-400">Genres</Text>
                <Text className={`font-medium flex-1 text-right ml-4 ${selectedGenreNames ? 'text-slate-900' : 'text-slate-400'}`} numberOfLines={1}>
                  {selectedGenreNames || 'None selected'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setThemeModalVisible(true)}
                className="px-4 py-3 flex-row items-center justify-between"
              >
                <Text className="text-xs font-semibold uppercase tracking-widest text-slate-400">Themes</Text>
                <Text className={`font-medium flex-1 text-right ml-4 ${selectedThemeNames ? 'text-slate-900' : 'text-slate-400'}`} numberOfLines={1}>
                  {selectedThemeNames || 'None selected'}
                </Text>
              </TouchableOpacity>
            </View>

            {error ? (
              <View className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <Text className="text-red-600 text-sm">{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              className="bg-amber-500 rounded-xl py-4 items-center mb-3"
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold text-base">Save changes</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleDelete} className="py-3 items-center">
              <Text className="text-red-500 font-medium">Delete jam</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
