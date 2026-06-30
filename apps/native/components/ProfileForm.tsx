import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  Modal, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

const PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

const RESERVED = new Set(['admin', 'support', 'help', 'singjam', 'sing', 'jam', 'connect', 'api', 'www', 'mail']);
const USERNAME_RE = /^[a-zA-Z0-9_]+$/;

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

type PlaceSuggestion = { description: string; placeId: string };

type Props = {
  title: string;
  subtitle: string;
  submitLabel: string;
  onSave: () => void;
};

const ALL_INSTRUMENTS = [
  'Guitar', 'Electric Bass', 'Upright Bass', 'Piano/Keys', 'Drums', 'Percussion',
  'Violin/Fiddle', 'Viola', 'Cello', 'Banjo', 'Mandolin', 'Ukulele', 'Flute',
  'Clarinet', 'Saxophone', 'Trumpet', 'Trombone', 'Harmonica', 'Accordion', 'Harp',
  'Dobro', 'Pedal Steel', 'Organ', 'Synthesizer',
  'Sitar', 'Tabla', 'Harmonium', 'Sarod', 'Bansuri', 'Veena', 'Mridangam',
  'Sarangi', 'Tanpura', 'Dholak', 'Oud', 'Darbuka', 'Qanun', 'Ney', 'Riq',
  'Rebab', 'Buzuq', 'Djembe', 'Kora', 'Mbira', 'Balafon', 'Kalimba',
  'Talking Drum', 'Ngoni', 'Shekere', 'Dundun', 'Erhu', 'Guzheng', 'Pipa',
  'Shamisen', 'Koto', 'Shakuhachi', 'Gayageum', 'Dizi', 'Taiko', 'Other',
];
const FEATURED_INSTRUMENTS = [
  'Guitar', 'Piano/Keys', 'Electric Bass', 'Upright Bass', 'Drums', 'Percussion',
  'Violin/Fiddle', 'Cello', 'Saxophone', 'Clarinet', 'Trumpet',
];
const INSTRUMENT_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Professional'] as const;
type InstrumentLevel = typeof INSTRUMENT_LEVELS[number];

const LEVEL_COLOR: Record<InstrumentLevel, string> = {
  Beginner: 'bg-slate-100 text-slate-500',
  Intermediate: 'bg-sky-50 text-sky-700',
  Advanced: 'bg-amber-50 text-amber-700',
  Professional: 'bg-green-50 text-green-700',
};

// ── Location modal ────────────────────────────────────────────────────────────

function LocationModal({
  visible,
  initial,
  onClose,
  onSelect,
}: {
  visible: boolean;
  initial: string;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  const [query, setQuery] = useState(initial);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) setQuery(initial);
  }, [visible, initial]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 2) { setSuggestions([]); return; }
    timer.current = setTimeout(() => fetchSuggestions(query.trim()), 300);
  }, [query]);

  async function fetchSuggestions(q: string) {
    setSearching(true);
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&key=${PLACES_KEY}&types=(cities)&language=en`;
      const res = await fetch(url);
      const json = await res.json();
      setSuggestions(
        (json.predictions ?? []).map((p: any) => ({
          description: p.description,
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
          <Text className="flex-1 text-center font-semibold text-slate-900">Your Location</Text>
          <View style={{ width: 50 }} />
        </View>

        <View className="px-4 py-3 border-b border-slate-100">
          <View className="flex-row items-center bg-slate-100 rounded-xl px-3 py-2">
            <Text className="text-slate-400 mr-2">🔍</Text>
            <TextInput
              className="flex-1 text-slate-900"
              placeholder="Search city or neighborhood…"
              placeholderTextColor="#94a3b8"
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCapitalize="words"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(''); setSuggestions([]); }}>
                <Text className="text-slate-400 ml-2">✕</Text>
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
            keyExtractor={(item) => item.placeId}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => { onSelect(item.description); onClose(); }}
                className="px-4 py-3 border-b border-slate-100"
              >
                <Text className="text-slate-900">📍 {item.description}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              query.length >= 2 ? (
                <View className="items-center justify-center pt-12">
                  <Text className="text-slate-400">No results found</Text>
                </View>
              ) : null
            }
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Instrument modal (two-step: pick instrument → pick level) ─────────────────

function InstrumentModal({
  visible,
  existing,
  onClose,
  onAdd,
}: {
  visible: boolean;
  existing: Record<string, string>;
  onClose: () => void;
  onAdd: (name: string, level: InstrumentLevel) => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (visible) { setQuery(''); setSelected(null); }
  }, [visible]);

  const available = ALL_INSTRUMENTS.filter(i => !existing[i]);
  const featuredAvailable = FEATURED_INSTRUMENTS.filter(i => !existing[i]);
  const trimmed = query.trim().toLowerCase();
  const filtered = trimmed
    ? available.filter(i => i.toLowerCase().includes(trimmed))
    : available;

  function handlePick(name: string) {
    setSelected(name);
    setQuery('');
  }

  function handleLevel(level: InstrumentLevel) {
    if (!selected) return;
    onAdd(selected, level);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View className="flex-row items-center px-4 pt-4 pb-2 border-b border-slate-100">
          <TouchableOpacity
            onPress={selected ? () => setSelected(null) : onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text className="text-amber-600 font-medium">{selected ? 'Back' : 'Cancel'}</Text>
          </TouchableOpacity>
          <Text className="flex-1 text-center font-semibold text-slate-900">
            {selected ? selected : 'Add Instrument'}
          </Text>
          <View style={{ width: 50 }} />
        </View>

        {selected ? (
          // Step 2: pick level
          <View className="flex-1 px-4 pt-6">
            <Text className="text-sm font-medium text-slate-500 mb-4 text-center">
              How would you rate your {selected} skills?
            </Text>
            {INSTRUMENT_LEVELS.map((level) => (
              <TouchableOpacity
                key={level}
                onPress={() => handleLevel(level)}
                className="border border-slate-200 rounded-xl px-4 py-4 mb-3"
              >
                <Text className="font-semibold text-slate-900">{level}</Text>
                <Text className="text-sm text-slate-400 mt-0.5">
                  {level === 'Beginner' && 'Learning the basics'}
                  {level === 'Intermediate' && 'Comfortable with most songs'}
                  {level === 'Advanced' && 'Highly proficient'}
                  {level === 'Professional' && 'Paid gigs, touring, or teaching'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          // Step 1: pick instrument
          <View className="flex-1">
            <View className="px-4 py-3 border-b border-slate-100">
              <View className="flex-row items-center bg-slate-100 rounded-xl px-3 py-2">
                <Ionicons name="search" size={16} color="#94a3b8" style={{ marginRight: 6 }} />
                <TextInput
                  className="flex-1 text-slate-900"
                  placeholder="Search instruments…"
                  placeholderTextColor="#94a3b8"
                  value={query}
                  onChangeText={setQuery}
                  autoCapitalize="words"
                />
                {query.length > 0 && (
                  <TouchableOpacity onPress={() => setQuery('')}>
                    <Ionicons name="close-circle" size={16} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {!trimmed && featuredAvailable.length > 0 && (
              <View className="px-4 pt-3 pb-2 border-b border-slate-100">
                <Text className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">
                  Common
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {featuredAvailable.map(i => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => handlePick(i)}
                      className="border border-slate-200 rounded-full px-3 py-1.5"
                    >
                      <Text className="text-sm text-slate-700">{i}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <FlatList
              data={filtered}
              keyExtractor={item => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handlePick(item)}
                  className="px-4 py-3 border-b border-slate-100 flex-row items-center justify-between"
                >
                  <Text className="text-slate-900">{item}</Text>
                  <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View className="items-center justify-center pt-12">
                  <Text className="text-slate-400">No instruments found</Text>
                </View>
              }
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Genre picker modal ────────────────────────────────────────────────────────

function GenrePickerModal({
  visible,
  allGenres,
  selected,
  onClose,
  onToggle,
}: {
  visible: boolean;
  allGenres: string[];
  selected: string[];
  onClose: () => void;
  onToggle: (genre: string) => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-white">
        <View className="flex-row items-center px-4 pt-4 pb-3 border-b border-slate-100">
          <View style={{ width: 48 }} />
          <Text className="flex-1 text-center font-semibold text-slate-900">Favourite Genres</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text className="text-amber-600 font-medium">Done</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={allGenres}
          keyExtractor={item => item}
          renderItem={({ item }) => {
            const checked = selected.includes(item);
            return (
              <TouchableOpacity
                onPress={() => onToggle(item)}
                className={`px-4 py-3 border-b border-slate-100 flex-row items-center justify-between ${checked ? 'bg-amber-50' : ''}`}
              >
                <Text className={`${checked ? 'text-amber-800 font-semibold' : 'text-slate-900'}`}>{item}</Text>
                {checked && <Ionicons name="checkmark" size={16} color="#d97706" />}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

// ── ProfileForm ───────────────────────────────────────────────────────────────

export default function ProfileForm({ title, subtitle, submitLabel, onSave }: Props) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [singing, setSinging] = useState<Set<string>>(new Set());
  const [instruments, setInstruments] = useState<Record<string, string>>({});
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>([]);
  const [allGenres, setAllGenres] = useState<string[]>([]);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [instrumentModalVisible, setInstrumentModalVisible] = useState(false);
  const [genrePickerVisible, setGenrePickerVisible] = useState(false);
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userId = useRef<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userId.current = user.id;
      const [{ data }, { data: genreRows }] = await Promise.all([
        supabase
          .from('profiles')
          .select('display_name, last_name, username, singing_voice, neighborhood, instrument_levels, favorite_genres')
          .eq('id', user.id)
          .single(),
        supabase.from('genres').select('name').order('name'),
      ]);
      if (data?.display_name) setFirstName(data.display_name);
      if (data?.last_name) setLastName(data.last_name);
      if (data?.username) setUsername(data.username);
      if (data?.neighborhood) setNeighborhood(data.neighborhood);
      if (data?.singing_voice) setSinging(new Set(data.singing_voice.split(',').filter(Boolean)));
      if (data?.instrument_levels && typeof data.instrument_levels === 'object') {
        setInstruments(data.instrument_levels as Record<string, string>);
      }
      if (data?.favorite_genres) setFavoriteGenres(data.favorite_genres as string[]);
      setAllGenres((genreRows ?? []).map((g: any) => g.name));
    }
    load();
  }, []);

  function handleUsernameChange(val: string) {
    setUsername(val);
    setUsernameStatus('idle');
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    if (val.length < 3) return;
    if (!USERNAME_RE.test(val)) { setUsernameStatus('invalid'); return; }
    if (RESERVED.has(val.toLowerCase())) { setUsernameStatus('taken'); return; }
    usernameTimer.current = setTimeout(() => checkUsername(val), 400);
  }

  async function checkUsername(val: string) {
    setUsernameStatus('checking');
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', val.toLowerCase())
      .neq('id', userId.current ?? '')
      .maybeSingle();
    setUsernameStatus(data ? 'taken' : 'available');
  }

  function toggleSinging(voice: string) {
    setSinging(prev => {
      const next = new Set(prev);
      if (next.has(voice)) next.delete(voice);
      else next.add(voice);
      return next;
    });
  }

  function addInstrument(name: string, level: InstrumentLevel) {
    setInstruments(prev => ({ ...prev, [name]: level }));
  }

  function removeInstrument(name: string) {
    setInstruments(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  function changeInstrumentLevel(name: string, level: InstrumentLevel) {
    setInstruments(prev => ({ ...prev, [name]: level }));
  }

  function toggleFavoriteGenre(genre: string) {
    setFavoriteGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  }

  async function handleSave() {
    setError(null);
    if (!firstName.trim()) { setError('First name is required.'); return; }
    if (username.length < 3) { setError('Username must be at least 3 characters.'); return; }
    if (!USERNAME_RE.test(username)) { setError('Username can only contain letters, numbers, and underscores.'); return; }
    if (usernameStatus === 'taken' || usernameStatus === 'invalid') { setError('Please choose a valid username.'); return; }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');

    const [{ error: saveError }] = await Promise.all([
      supabase.from('profiles').upsert({
        id: user.id,
        display_name: firstName.trim(),
        last_name: lastName.trim() || null,
        username: username.toLowerCase().trim(),
        singing_voice: Array.from(singing).join(',') || null,
        neighborhood: neighborhood.trim() || null,
        instrument_levels: Object.keys(instruments).length > 0 ? instruments : null,
        favorite_genres: favoriteGenres.length > 0 ? favoriteGenres : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' }),
      supabase.auth.updateUser({ data: { name: fullName, full_name: fullName } }),
    ]);

    setSaving(false);
    if (saveError) { setError(saveError.message); return; }
    onSave();
  }

  const usernameHint = {
    idle: null,
    checking: 'Checking…',
    available: '✓ Available',
    taken: '✗ Already taken',
    invalid: 'Letters, numbers, and underscores only',
  }[usernameStatus];

  const usernameHintColor =
    usernameStatus === 'available' ? 'text-green-600' :
    usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'text-red-500' :
    'text-slate-400';

  const instrumentEntries = Object.entries(instruments);

  return (
    <>
      <LocationModal
        visible={locationModalVisible}
        initial={neighborhood}
        onClose={() => setLocationModalVisible(false)}
        onSelect={setNeighborhood}
      />
      <InstrumentModal
        visible={instrumentModalVisible}
        existing={instruments}
        onClose={() => setInstrumentModalVisible(false)}
        onAdd={addInstrument}
      />
      <GenrePickerModal
        visible={genrePickerVisible}
        allGenres={allGenres}
        selected={favoriteGenres}
        onClose={() => setGenrePickerVisible(false)}
        onToggle={toggleFavoriteGenre}
      />

      <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
          <View className="px-6 pt-16 pb-10">
            <Text className="text-3xl font-bold text-slate-900 mb-1">{title}</Text>
            <Text className="text-slate-400 mb-8">{subtitle}</Text>

            {/* Name row */}
            <View className="flex-row mb-4">
              <View className="flex-1 mr-2">
                <Text className="text-sm font-medium text-slate-700 mb-1">First name</Text>
                <TextInput
                  className="border border-slate-200 rounded-xl px-4 py-3 text-slate-900"
                  placeholder="Jane"
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                />
              </View>
              <View className="flex-1 ml-2">
                <Text className="text-sm font-medium text-slate-700 mb-1">Last name</Text>
                <TextInput
                  className="border border-slate-200 rounded-xl px-4 py-3 text-slate-900"
                  placeholder="Smith"
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Username */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-slate-700 mb-1">Username</Text>
              <View className="flex-row items-center border border-slate-200 rounded-xl px-4 py-3">
                <Text className="text-slate-400 mr-1">@</Text>
                <TextInput
                  className="flex-1 text-slate-900"
                  placeholder="yourname"
                  value={username}
                  onChangeText={handleUsernameChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {usernameStatus === 'checking' && <ActivityIndicator size="small" color="#94a3b8" />}
              </View>
              {usernameHint ? (
                <Text className={`text-xs mt-1 ${usernameHintColor}`}>{usernameHint}</Text>
              ) : null}
            </View>

            {/* Location */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-slate-700 mb-1">Location</Text>
              <TouchableOpacity
                onPress={() => setLocationModalVisible(true)}
                className="border border-slate-200 rounded-xl px-4 py-3 flex-row items-center"
              >
                <Text className="text-slate-400 mr-2">📍</Text>
                <Text className={`flex-1 ${neighborhood ? 'text-slate-900' : 'text-slate-400'}`}>
                  {neighborhood || 'City or neighborhood'}
                </Text>
                {neighborhood ? (
                  <TouchableOpacity
                    onPress={() => setNeighborhood('')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text className="text-slate-400">✕</Text>
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            </View>

            {/* Singing voice */}
            <View className="mb-6">
              <Text className="text-sm font-medium text-slate-700 mb-2">Singing</Text>
              <View className="flex-row mb-3">
                {(['lead', 'backup'] as const).map((voice, i) => {
                  const active = singing.has(voice);
                  return (
                    <TouchableOpacity
                      key={voice}
                      onPress={() => toggleSinging(voice)}
                      className={`flex-1 rounded-xl py-3 items-center border ${i === 0 ? 'mr-2' : 'ml-2'} ${
                        active ? 'bg-amber-500 border-amber-500' : 'bg-white border-slate-200'
                      }`}
                    >
                      <Text className={`font-medium text-sm ${active ? 'text-white' : 'text-slate-600'}`}>
                        {voice === 'lead' ? 'Lead vocals' : 'Backup vocals'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                onPress={() => setSinging(new Set())}
                className={`rounded-xl py-3 items-center border ${
                  singing.size === 0 ? 'bg-slate-100 border-slate-200' : 'bg-white border-slate-200'
                }`}
              >
                <Text className={`font-medium text-sm ${singing.size === 0 ? 'text-slate-700' : 'text-slate-400'}`}>
                  I don't sing
                </Text>
              </TouchableOpacity>
            </View>

            {/* Instruments */}
            <View className="mb-8">
              <Text className="text-sm font-medium text-slate-700 mb-2">Instruments</Text>

              {instrumentEntries.map(([name, level]) => (
                <View
                  key={name}
                  className="flex-row items-center border border-slate-200 rounded-xl px-3 py-2 mb-2"
                >
                  <Text className="flex-1 text-slate-900 font-medium">{name}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-none">
                    <View className="flex-row gap-1">
                      {INSTRUMENT_LEVELS.map(lvl => (
                        <TouchableOpacity
                          key={lvl}
                          onPress={() => changeInstrumentLevel(name, lvl)}
                          className={`rounded-full px-2 py-0.5 ${level === lvl ? 'bg-amber-500' : 'bg-slate-100'}`}
                        >
                          <Text className={`text-xs font-medium ${level === lvl ? 'text-white' : 'text-slate-500'}`}>
                            {lvl}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                  <TouchableOpacity
                    onPress={() => removeInstrument(name)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    className="ml-3"
                  >
                    <Ionicons name="close-circle" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                onPress={() => setInstrumentModalVisible(true)}
                className="border border-dashed border-slate-300 rounded-xl py-3 items-center flex-row justify-center"
              >
                <Ionicons name="add" size={16} color="#94a3b8" />
                <Text className="text-slate-400 font-medium ml-1 text-sm">Add instrument</Text>
              </TouchableOpacity>
            </View>

            {/* Favourite genres */}
            <View className="mb-8">
              <Text className="text-sm font-medium text-slate-700 mb-2">Favourite Genres</Text>
              {favoriteGenres.length > 0 && (
                <View className="flex-row flex-wrap gap-1.5 mb-3">
                  {favoriteGenres.sort((a, b) => a.localeCompare(b)).map(g => (
                    <TouchableOpacity
                      key={g}
                      onPress={() => toggleFavoriteGenre(g)}
                      className="flex-row items-center bg-amber-50 border border-amber-200 rounded-full px-3 py-1"
                    >
                      <Text className="text-amber-800 text-sm mr-1">{g}</Text>
                      <Ionicons name="close-circle" size={14} color="#d97706" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <TouchableOpacity
                onPress={() => setGenrePickerVisible(true)}
                className="border border-dashed border-slate-300 rounded-xl py-3 items-center flex-row justify-center"
              >
                <Ionicons name="add" size={16} color="#94a3b8" />
                <Text className="text-slate-400 font-medium ml-1 text-sm">
                  {favoriteGenres.length > 0 ? 'Edit genres' : 'Add genres'}
                </Text>
              </TouchableOpacity>
            </View>

            {error ? <Text className="text-red-500 text-sm mb-3">{error}</Text> : null}

            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              className="bg-amber-500 rounded-xl py-4 items-center"
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold text-base">{submitLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
