import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, Modal, FlatList, TextInput,
  KeyboardAvoidingView, Platform, ActionSheetIOS,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { formatComposers } from '@singjam/core';

const MUSICAL_KEYS = ['A', 'Bb', 'B', 'C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab'];

type SetData = {
  id: string;
  name: string;
  description: string | null;
  owner_user_id: string;
  link_sharing: 'private' | 'link' | 'public';
};

type SetSong = {
  id: string;
  song_id: string;
  position: number;
  key_note: string | null;
  leader_user_ids: string[];
  songs: {
    title: string;
    display_artist: string | null;
    song_composers: { people: { name: string } | null }[];
  };
};

type SongSearchResult = {
  song_id: string;
  title: string;
  display_artist: string | null;
};

function AddSongModal({
  visible,
  existingIds,
  onClose,
  onAdded,
}: {
  visible: boolean;
  existingIds: Set<string>;
  onClose: () => void;
  onAdded: (song: SetSong) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SongSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { id: setId } = useLocalSearchParams<{ id: string }>();

  useEffect(() => {
    if (!visible) { setQuery(''); setResults([]); }
  }, [visible]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(() => search(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  async function search(q: string) {
    setSearching(true);
    const { data } = await supabase
      .from('songs')
      .select('song_id, title, display_artist')
      .or(`title.ilike.%${q}%,display_artist.ilike.%${q}%`)
      .order('title')
      .limit(30);
    setResults(data ?? []);
    setSearching(false);
  }

  async function addSong(song: SongSearchResult) {
    setPendingId(song.song_id);
    const { data: existing } = await supabase
      .from('set_songs')
      .select('position')
      .eq('set_id', setId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextPosition = (existing?.position ?? 0) + 1;

    const { data, error } = await supabase
      .from('set_songs')
      .insert({
        set_id: setId,
        song_id: song.song_id,
        position: nextPosition,
        leader_user_ids: [],
      })
      .select('id, song_id, position, key_note, leader_user_ids, songs(title, display_artist, song_composers(people(name)))')
      .single();

    setPendingId(null);
    if (error) { Alert.alert('Error', error.message); return; }
    onAdded(data as any as SetSong);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View className="flex-row items-center px-4 pt-4 pb-2 border-b border-slate-100">
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text className="text-amber-600 font-medium">Done</Text>
          </TouchableOpacity>
          <Text className="flex-1 text-center font-semibold text-slate-900">Add Song</Text>
          <View style={{ width: 50 }} />
        </View>

        <View className="px-4 py-3 border-b border-slate-100">
          <View className="flex-row items-center bg-slate-100 rounded-xl px-3 py-2">
            <Text className="text-slate-400 mr-2">🔍</Text>
            <TextInput
              className="flex-1 text-slate-900"
              placeholder="Search by title or artist…"
              placeholderTextColor="#94a3b8"
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCapitalize="none"
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Text className="text-slate-400 ml-2">✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {searching ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#d97706" />
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.song_id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const already = existingIds.has(item.song_id);
              const pending = pendingId === item.song_id;
              return (
                <View className="flex-row items-center px-4 py-3 border-b border-slate-100">
                  <View className="flex-1 mr-3">
                    <Text className="text-slate-900 font-medium" numberOfLines={1}>{item.title}</Text>
                    {item.display_artist ? (
                      <Text className="text-slate-400 text-sm mt-0.5" numberOfLines={1}>{item.display_artist}</Text>
                    ) : null}
                  </View>
                  {already ? (
                    <Text className="text-slate-400 text-sm">Added</Text>
                  ) : pending ? (
                    <ActivityIndicator size="small" color="#d97706" />
                  ) : (
                    <TouchableOpacity
                      onPress={() => addSong(item)}
                      className="bg-amber-500 rounded-full px-3 py-1"
                    >
                      <Text className="text-white text-sm font-medium">Add</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
            ListEmptyComponent={
              query.length > 0 ? (
                <Text className="text-center text-slate-400 mt-12">No songs found</Text>
              ) : null
            }
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function KeyPicker({
  visible,
  current,
  onClose,
  onSelect,
}: {
  visible: boolean;
  current: string | null;
  onClose: () => void;
  onSelect: (key: string | null) => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-white">
        <View className="flex-row items-center px-4 pt-4 pb-2 border-b border-slate-100">
          <TouchableOpacity onPress={onClose}>
            <Text className="text-amber-600 font-medium">Cancel</Text>
          </TouchableOpacity>
          <Text className="flex-1 text-center font-semibold text-slate-900">Select Key</Text>
          <TouchableOpacity onPress={() => { onSelect(null); onClose(); }}>
            <Text className="text-slate-400 font-medium">Clear</Text>
          </TouchableOpacity>
        </View>
        <ScrollView>
          {MUSICAL_KEYS.map((k) => (
            <TouchableOpacity
              key={k}
              onPress={() => { onSelect(k); onClose(); }}
              className={`px-6 py-4 border-b border-slate-100 flex-row items-center justify-between ${current === k ? 'bg-amber-50' : ''}`}
            >
              <Text className={`text-base ${current === k ? 'text-amber-700 font-semibold' : 'text-slate-900'}`}>{k}</Text>
              {current === k ? <Ionicons name="checkmark" size={18} color="#d97706" /> : null}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

function SongRow({
  song,
  canEdit,
  onRemove,
  onKeyChange,
}: {
  song: SetSong;
  canEdit: boolean;
  onRemove: () => void;
  onKeyChange: (key: string | null) => void;
}) {
  const [keyPickerVisible, setKeyPickerVisible] = useState(false);
  const composerNames = (song.songs.song_composers ?? [])
    .map((sc) => sc.people?.name)
    .filter(Boolean) as string[];
  const artist = song.songs.display_artist ?? formatComposers(composerNames, []);

  function confirmRemove() {
    Alert.alert(
      'Remove Song',
      `Remove "${song.songs.title}" from this set?`,
      [
        { text: 'Remove', style: 'destructive', onPress: onRemove },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }

  return (
    <>
      <KeyPicker
        visible={keyPickerVisible}
        current={song.key_note}
        onClose={() => setKeyPickerVisible(false)}
        onSelect={onKeyChange}
      />
      <View className="flex-row items-center px-4 py-3 border-b border-slate-100 bg-white">
        <View className="w-7 items-center mr-2">
          <Text className="text-slate-300 text-sm font-medium">{song.position}</Text>
        </View>
        <View className="flex-1 min-w-0">
          <Text className="text-slate-900 font-medium" numberOfLines={1}>{song.songs.title}</Text>
          {artist ? (
            <Text className="text-slate-400 text-sm mt-0.5" numberOfLines={1}>{artist}</Text>
          ) : null}
        </View>
        {canEdit ? (
          <TouchableOpacity
            onPress={() => setKeyPickerVisible(true)}
            className={`mr-3 px-2.5 py-1 rounded-lg border ${song.key_note ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}
          >
            <Text className={`text-xs font-medium ${song.key_note ? 'text-amber-700' : 'text-slate-400'}`}>
              {song.key_note ?? 'Key'}
            </Text>
          </TouchableOpacity>
        ) : song.key_note ? (
          <View className="mr-3 px-2.5 py-1 rounded-lg border border-amber-200 bg-amber-50">
            <Text className="text-xs font-medium text-amber-700">{song.key_note}</Text>
          </View>
        ) : null}
        {canEdit ? (
          <TouchableOpacity onPress={confirmRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={16} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>
    </>
  );
}

export default function SetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [set, setSet] = useState<SetData | null>(null);
  const [songs, setSongs] = useState<SetSong[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);

  useEffect(() => {
    if (id) load();
  }, [id]);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyUserId(user.id);

    const [setRes, songsRes, collabRes] = await Promise.all([
      supabase
        .from('sets')
        .select('id, name, description, owner_user_id, link_sharing')
        .eq('id', id)
        .single(),
      supabase
        .from('set_songs')
        .select('id, song_id, position, key_note, leader_user_ids, songs(title, display_artist, song_composers(people(name)))')
        .eq('set_id', id)
        .order('position', { ascending: true }),
      supabase
        .from('set_collaborators')
        .select('role')
        .eq('set_id', id)
        .eq('user_id', user.id)
        .eq('status', 'accepted')
        .maybeSingle(),
    ]);

    if (!setRes.data) { setNotFound(true); setLoading(false); return; }

    const s = setRes.data as any;
    setSet(s);
    setSongs((songsRes.data ?? []) as any as SetSong[]);

    const isOwner = s.owner_user_id === user.id;
    const isEditor = collabRes.data?.role === 'editor';
    setCanEdit(isOwner || isEditor);
    setLoading(false);
  }

  function handleSongAdded(song: SetSong) {
    setSongs((prev) => [...prev, song]);
  }

  async function handleRemoveSong(setsSongId: string) {
    const { error } = await supabase.from('set_songs').delete().eq('id', setsSongId);
    if (error) { Alert.alert('Error', error.message); return; }
    setSongs((prev) => {
      const filtered = prev.filter((s) => s.id !== setsSongId);
      return filtered.map((s, i) => ({ ...s, position: i + 1 }));
    });
  }

  async function handleKeyChange(setsSongId: string, key: string | null) {
    const { error } = await supabase
      .from('set_songs')
      .update({ key_note: key })
      .eq('id', setsSongId);
    if (error) { Alert.alert('Error', error.message); return; }
    setSongs((prev) => prev.map((s) => s.id === setsSongId ? { ...s, key_note: key } : s));
  }

  function confirmDeleteSet() {
    Alert.alert(
      'Delete Set',
      `Delete "${set?.name}"? This cannot be undone.`,
      [
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('sets').delete().eq('id', id);
            if (error) { Alert.alert('Error', error.message); return; }
            router.back();
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: '' }} />
        <View className="flex-1 bg-white items-center justify-center">
          <ActivityIndicator color="#d97706" />
        </View>
      </>
    );
  }

  if (notFound || !set) {
    return (
      <>
        <Stack.Screen options={{ title: 'Set' }} />
        <View className="flex-1 bg-white items-center justify-center">
          <Text className="text-slate-400">Set not found</Text>
        </View>
      </>
    );
  }

  const isOwner = set.owner_user_id === myUserId;
  const existingIds = new Set(songs.map((s) => s.song_id));

  return (
    <>
      <Stack.Screen
        options={{
          title: set.name,
          headerTintColor: '#d97706',
          headerRight: isOwner
            ? () => (
                <TouchableOpacity onPress={confirmDeleteSet} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              )
            : undefined,
        }}
      />

      <AddSongModal
        visible={addModalVisible}
        existingIds={existingIds}
        onClose={() => setAddModalVisible(false)}
        onAdded={handleSongAdded}
      />

      <View className="flex-1 bg-white">
        {set.description ? (
          <View className="px-4 py-3 border-b border-slate-100">
            <Text className="text-slate-500 text-sm">{set.description}</Text>
          </View>
        ) : null}

        <ScrollView className="flex-1">
          {songs.length === 0 ? (
            <View className="items-center justify-center py-20 px-8">
              <Text className="text-slate-900 font-semibold mb-1">No songs yet</Text>
              <Text className="text-slate-400 text-sm text-center">
                {canEdit ? 'Tap "Add Song" to start building this set.' : 'This set has no songs yet.'}
              </Text>
            </View>
          ) : (
            songs.map((song) => (
              <SongRow
                key={song.id}
                song={song}
                canEdit={canEdit}
                onRemove={() => handleRemoveSong(song.id)}
                onKeyChange={(key) => handleKeyChange(song.id, key)}
              />
            ))
          )}
          <View style={{ height: 80 }} />
        </ScrollView>

        {canEdit ? (
          <View className="absolute bottom-0 left-0 right-0 px-4 pb-8 pt-2 bg-white border-t border-slate-100">
            <TouchableOpacity
              onPress={() => setAddModalVisible(true)}
              className="bg-amber-500 rounded-xl py-3.5 items-center flex-row justify-center gap-2"
            >
              <Ionicons name="add" size={18} color="white" />
              <Text className="text-white font-semibold">Add Song</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </>
  );
}
