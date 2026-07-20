import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, Modal, FlatList, TextInput,
  KeyboardAvoidingView, Platform, ActionSheetIOS, Linking,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import { supabase } from '@/lib/supabase';
import { formatComposers, reorderSongsForPlayed } from '@singjam/core';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://singjam.org';

const MUSICAL_KEYS = ['A', 'Bb', 'B', 'C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab'];

type SetSortOrder = 'custom' | 'title_asc' | 'title_desc';

type SetData = {
  id: string;
  name: string;
  description: string | null;
  owner_user_id: string;
  link_sharing: 'private' | 'link' | 'public';
  spotify_playlist_id: string | null;
};

type SetSong = {
  id: string;
  song_id: string;
  position: number;
  key_note: string | null;
  played: boolean;
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
      .select('id, song_id, position, key_note, played, leader_user_ids, songs(title, display_artist, song_composers(people(name)))')
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
  displayPosition,
  drag,
  isActive,
  myUserId,
  onRemove,
  onKeyChange,
  onLeaderToggle,
  onTogglePlayed,
}: {
  song: SetSong;
  canEdit: boolean;
  displayPosition: number;
  drag?: () => void;
  isActive?: boolean;
  myUserId: string | null;
  onRemove: () => void;
  onKeyChange: (key: string | null) => void;
  onLeaderToggle: (newLeaderIds: string[]) => void;
  onTogglePlayed: () => void;
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
      <View className={`flex-row items-center px-4 py-3 border-b border-slate-100 ${isActive ? 'bg-amber-50' : 'bg-white'}`}>
        {canEdit && drag ? (
          <TouchableOpacity
            onLongPress={drag}
            delayLongPress={150}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="mr-3"
          >
            <Ionicons name="reorder-three-outline" size={20} color="#94a3b8" />
          </TouchableOpacity>
        ) : (
          <View className="w-7 items-center mr-2">
            <Text className="text-slate-300 text-sm font-medium">{displayPosition}</Text>
          </View>
        )}
        <View className="flex-1 min-w-0">
          <Text className="text-slate-900 font-medium" numberOfLines={1}>{song.songs.title}</Text>
          {artist ? (
            <Text className="text-slate-400 text-sm mt-0.5" numberOfLines={1}>{artist}</Text>
          ) : null}
        </View>
        {canEdit ? (
          <TouchableOpacity
            onPress={onTogglePlayed}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="mr-3"
          >
            <Ionicons
              name={song.played ? 'checkmark-circle' : 'checkmark-circle-outline'}
              size={18}
              color={song.played ? '#16a34a' : '#94a3b8'}
            />
          </TouchableOpacity>
        ) : song.played ? (
          <View className="mr-3">
            <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
          </View>
        ) : null}
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
        {canEdit && myUserId ? (
          <TouchableOpacity
            onPress={() => {
              const isLeader = song.leader_user_ids.includes(myUserId);
              const newIds = isLeader
                ? song.leader_user_ids.filter(id => id !== myUserId)
                : [...song.leader_user_ids, myUserId];
              onLeaderToggle(newIds);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="mr-3"
          >
            <Ionicons
              name={song.leader_user_ids.includes(myUserId ?? '') ? 'star' : 'star-outline'}
              size={16}
              color={song.leader_user_ids.includes(myUserId ?? '') ? '#d97706' : '#94a3b8'}
            />
          </TouchableOpacity>
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

type Collaborator = { id: string; user_id: string; role: string; display_name: string | null; username: string | null };

function SetSettingsModal({
  visible,
  setId,
  isOwner,
  linkSharing,
  collaborators,
  onClose,
  onSharingChange,
  onCollaboratorAdded,
  onCollaboratorRemoved,
}: {
  visible: boolean;
  setId: string;
  isOwner: boolean;
  linkSharing: string;
  collaborators: Collaborator[];
  onClose: () => void;
  onSharingChange: (mode: 'private' | 'link' | 'public') => void;
  onCollaboratorAdded: (c: Collaborator) => void;
  onCollaboratorRemoved: (id: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; display_name: string | null; last_name: string | null; username: string | null }[]>([]);
  const [searching, setSearching] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) { setSearchQuery(''); setSearchResults([]); setAddedIds(new Set()); }
  }, [visible]);

  useEffect(() => {
    if (searchQuery.trim().length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(() => runSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function runSearch(q: string) {
    setSearching(true);
    const { data } = await supabase.rpc('search_users', {
      search_query: q.startsWith('@') ? q.slice(1) : q,
      exclude_user_id: '',
    });
    const existing = new Set(collaborators.map(c => c.user_id));
    setSearchResults(((data ?? []) as any[]).filter((u: any) => !existing.has(u.id)));
    setSearching(false);
  }

  async function handleAddCollaborator(user: { id: string; display_name: string | null; last_name: string | null; username: string | null }) {
    const { data, error } = await supabase
      .from('set_collaborators')
      .insert({ set_id: setId, user_id: user.id, role: 'editor', status: 'accepted' })
      .select('id, user_id, role')
      .single();
    if (error && !error.message.includes('duplicate')) {
      Alert.alert('Error', error.message);
      return;
    }
    setAddedIds(prev => new Set([...prev, user.id]));
    if (data) {
      onCollaboratorAdded({
        id: data.id,
        user_id: data.user_id,
        role: data.role,
        display_name: user.display_name,
        username: user.username,
      });
    }
    setSearchQuery('');
    setSearchResults([]);
  }

  async function handleRemoveCollaborator(collab: Collaborator) {
    Alert.alert(
      'Remove collaborator',
      `Remove ${collab.display_name ?? collab.username ?? 'this person'}?`,
      [
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('set_collaborators').delete().eq('id', collab.id);
            onCollaboratorRemoved(collab.id);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }

  const SHARING_OPTIONS: { value: 'private' | 'link' | 'public'; label: string; desc: string }[] = [
    { value: 'private', label: 'Private', desc: 'Only you and collaborators' },
    { value: 'link', label: 'Open link', desc: 'Anyone with the link can join as viewer' },
    { value: 'public', label: 'Public', desc: 'Visible to everyone on SingJam' },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View className="flex-row items-center px-4 pt-4 pb-3 border-b border-slate-100">
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text className="text-amber-600 font-medium">Done</Text>
          </TouchableOpacity>
          <Text className="flex-1 text-center font-semibold text-slate-900">Set Settings</Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView keyboardShouldPersistTaps="handled">
          {/* Sharing controls (owner only) */}
          {isOwner && (
            <View className="px-4 pt-5 pb-2">
              <Text className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Sharing</Text>
              {SHARING_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => onSharingChange(opt.value)}
                  className={`flex-row items-center px-4 py-3 mb-2 rounded-xl border ${linkSharing === opt.value ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white'}`}
                >
                  <View className="flex-1">
                    <Text className={`font-semibold ${linkSharing === opt.value ? 'text-amber-800' : 'text-slate-900'}`}>{opt.label}</Text>
                    <Text className="text-xs text-slate-400 mt-0.5">{opt.desc}</Text>
                  </View>
                  {linkSharing === opt.value && <Ionicons name="checkmark" size={18} color="#d97706" />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Collaborators */}
          <View className="px-4 pt-4 pb-8">
            <Text className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Collaborators</Text>

            {collaborators.length === 0 ? (
              <Text className="text-slate-400 text-sm mb-4">No collaborators yet.</Text>
            ) : (
              collaborators.map(c => (
                <View key={c.id} className="flex-row items-center py-2 border-b border-slate-50">
                  <View className="flex-1">
                    <Text className="text-slate-900 font-medium">{c.display_name ?? c.username ?? 'Unknown'}</Text>
                    {c.username ? <Text className="text-xs text-slate-400">@{c.username}</Text> : null}
                  </View>
                  <Text className="text-xs text-slate-400 mr-3 capitalize">{c.role}</Text>
                  {isOwner && (
                    <TouchableOpacity onPress={() => handleRemoveCollaborator(c)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle-outline" size={18} color="#94a3b8" />
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}

            {isOwner && (
              <View className="mt-4">
                <View className="flex-row items-center bg-slate-100 rounded-xl px-3 py-2 mb-2">
                  <Ionicons name="search" size={14} color="#94a3b8" style={{ marginRight: 6 }} />
                  <TextInput
                    className="flex-1 text-slate-900"
                    placeholder="Search by name or @username…"
                    placeholderTextColor="#94a3b8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {searching && <ActivityIndicator size="small" color="#94a3b8" />}
                </View>
                {searchResults.map(user => {
                  const name = [user.display_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Unknown';
                  const isAdded = addedIds.has(user.id);
                  return (
                    <View key={user.id} className="flex-row items-center py-2 border-b border-slate-50">
                      <View className="flex-1">
                        <Text className="text-slate-900 font-medium">{name}</Text>
                        {user.username ? <Text className="text-xs text-slate-400">@{user.username}</Text> : null}
                      </View>
                      <TouchableOpacity
                        onPress={() => handleAddCollaborator(user)}
                        disabled={isAdded}
                        className={`rounded-full px-3 py-1 ${isAdded ? 'bg-green-100' : 'bg-amber-500'}`}
                      >
                        <Text className={`text-xs font-semibold ${isAdded ? 'text-green-700' : 'text-white'}`}>
                          {isAdded ? 'Added' : 'Add'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
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
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [collaborators, setCollaborators] = useState<{ id: string; user_id: string; role: string; display_name: string | null; username: string | null }[]>([]);
  const [sortBy, setSortBy] = useState<SetSortOrder>('custom');
  const [filterQuery, setFilterQuery] = useState('');
  const [spotifyExporting, setSpotifyExporting] = useState(false);

  useEffect(() => {
    if (id) load();
  }, [id]);

  // Live-sync the set the same way the web SetDetail does. Supabase can't
  // filter DELETE events (the old row is primary-key-only under RLS), so the
  // set_songs/set_collaborators DELETE handlers subscribe unfiltered and match
  // on the local `id` instead of trusting payload.old.
  useEffect(() => {
    if (!id) return;
    const bySong = 'id, song_id, position, key_note, played, leader_user_ids, songs(title, display_artist, song_composers(people(name)))';
    const sortByPosition = (rows: SetSong[]) => [...rows].sort((a, b) => a.position - b.position);

    const channel = supabase
      .channel(`set-detail-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'set_songs', filter: `set_id=eq.${id}` },
        async (payload) => {
          const row = payload.new as any;
          const { data } = await supabase.from('set_songs').select(bySong).eq('id', row.id).single();
          if (!data) return;
          setSongs((prev) =>
            prev.some((s) => s.id === row.id) ? prev : sortByPosition([...prev, data as any as SetSong])
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'set_songs', filter: `set_id=eq.${id}` },
        (payload) => {
          const row = payload.new as any;
          setSongs((prev) =>
            sortByPosition(
              prev.map((s) =>
                s.id === row.id
                  ? { ...s, position: row.position, key_note: row.key_note, played: row.played, leader_user_ids: row.leader_user_ids }
                  : s
              )
            )
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'set_songs' },
        (payload) => {
          const row = payload.old as any;
          setSongs((prev) => prev.filter((s) => s.id !== row.id));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sets', filter: `id=eq.${id}` },
        (payload) => {
          const row = payload.new as any;
          setSet((prev) =>
            prev
              ? {
                  ...prev,
                  name: row.name,
                  description: row.description ?? null,
                  link_sharing: row.link_sharing,
                  spotify_playlist_id: row.spotify_playlist_id ?? null,
                }
              : prev
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'set_collaborators', filter: `set_id=eq.${id}` },
        async (payload) => {
          const row = payload.new as any;
          if (row.status !== 'accepted') return;
          const { data: prof } = await supabase.from('profiles').select('display_name, username').eq('id', row.user_id).single();
          setCollaborators((prev) =>
            prev.some((c) => c.id === row.id)
              ? prev
              : [...prev, { id: row.id, user_id: row.user_id, role: row.role, display_name: (prof as any)?.display_name ?? null, username: (prof as any)?.username ?? null }]
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'set_collaborators', filter: `set_id=eq.${id}` },
        async (payload) => {
          const row = payload.new as any;
          const old = payload.old as any;
          if (row.status === 'accepted' && old.status !== 'accepted') {
            const { data: prof } = await supabase.from('profiles').select('display_name, username').eq('id', row.user_id).single();
            setCollaborators((prev) =>
              prev.some((c) => c.id === row.id)
                ? prev
                : [...prev, { id: row.id, user_id: row.user_id, role: row.role, display_name: (prof as any)?.display_name ?? null, username: (prof as any)?.username ?? null }]
            );
          } else if (row.status === 'accepted') {
            setCollaborators((prev) => prev.map((c) => (c.id === row.id ? { ...c, role: row.role } : c)));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'set_collaborators' },
        (payload) => {
          const row = payload.old as any;
          setCollaborators((prev) => prev.filter((c) => c.id !== row.id));
        }
      );

    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyUserId(user.id);

    const [setRes, songsRes, collabRes, allCollabRes] = await Promise.all([
      supabase
        .from('sets')
        .select('id, name, description, owner_user_id, link_sharing, spotify_playlist_id')
        .eq('id', id)
        .single(),
      supabase
        .from('set_songs')
        .select('id, song_id, position, key_note, played, leader_user_ids, songs(title, display_artist, song_composers(people(name)))')
        .eq('set_id', id)
        .order('position', { ascending: true }),
      supabase
        .from('set_collaborators')
        .select('role')
        .eq('set_id', id)
        .eq('user_id', user.id)
        .eq('status', 'accepted')
        .maybeSingle(),
      supabase
        .from('set_collaborators')
        .select('id, user_id, role, profiles(display_name, username)')
        .eq('set_id', id)
        .eq('status', 'accepted'),
    ]);

    if (!setRes.data) { setNotFound(true); setLoading(false); return; }

    const s = setRes.data as any;
    setSet(s);
    setSongs((songsRes.data ?? []) as any as SetSong[]);

    const isOwner = s.owner_user_id === user.id;
    const isEditor = collabRes.data?.role === 'editor';
    setCanEdit(isOwner || isEditor);

    const collabs: Collaborator[] = ((allCollabRes.data ?? []) as any[]).map((c: any) => ({
      id: c.id,
      user_id: c.user_id,
      role: c.role,
      display_name: c.profiles?.display_name ?? null,
      username: c.profiles?.username ?? null,
    }));
    setCollaborators(collabs);
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

  async function handleLeaderToggle(setsSongId: string, newLeaderIds: string[]) {
    const { error } = await supabase
      .from('set_songs')
      .update({ leader_user_ids: newLeaderIds })
      .eq('id', setsSongId);
    if (error) { Alert.alert('Error', error.message); return; }
    setSongs((prev) => prev.map((s) => s.id === setsSongId ? { ...s, leader_user_ids: newLeaderIds } : s));
  }

  async function handleReorder(data: SetSong[]) {
    const reordered = data.map((s, i) => ({ ...s, position: i + 1 }));
    setSongs(reordered);
    await Promise.all(
      reordered.map(s => supabase.from('set_songs').update({ position: s.position }).eq('id', s.id))
    );
  }

  async function handleTogglePlayed(setsSongId: string, played: boolean) {
    const previous = songs;
    const reordered = reorderSongsForPlayed(songs, setsSongId, played)
      .map((s, i) => ({ ...s, position: i + 1 }));
    setSongs(reordered);
    const results = await Promise.all([
      supabase.from('set_songs').update({ played }).eq('id', setsSongId),
      ...reordered.map(s => supabase.from('set_songs').update({ position: s.position }).eq('id', s.id)),
    ]);
    if (results.some(r => r.error)) {
      setSongs(previous);
      Alert.alert('Error', 'Could not update the set.');
    }
  }

  async function handleSpotifyExport() {
    setSpotifyExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${WEB_URL}/api/sets/${id}/playlists/spotify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ songOrder: songs.map(s => s.song_id) }),
      });
      const json = await res.json();
      if (!res.ok) {
        Alert.alert('Export failed', json.error === 'spotify_auth_expired'
          ? 'The Spotify connection has expired. An admin has been notified.'
          : json.error ?? 'Something went wrong.');
        return;
      }
      setSet(prev => prev ? { ...prev, spotify_playlist_id: json.url } : prev);
      Alert.alert(
        'Exported to Spotify',
        `${json.added} of ${json.total} songs added.`,
        [
          { text: 'Open playlist', onPress: () => Linking.openURL(json.url) },
          { text: 'OK', style: 'cancel' },
        ]
      );
    } catch {
      Alert.alert('Error', 'Could not reach the server.');
    } finally {
      setSpotifyExporting(false);
    }
  }

  async function handleSharingChange(mode: 'private' | 'link' | 'public') {
    if (!set) return;
    await supabase.from('sets').update({ link_sharing: mode }).eq('id', set.id);
    setSet(prev => prev ? { ...prev, link_sharing: mode } : prev);
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

  const displayedSongs = useMemo(() => {
    let result = songs;
    if (filterQuery.trim()) {
      const q = filterQuery.trim().toLowerCase();
      result = result.filter(s => s.songs.title.toLowerCase().includes(q) || (s.songs.display_artist ?? '').toLowerCase().includes(q));
    }
    if (sortBy === 'title_asc') return [...result].sort((a, b) => a.songs.title.localeCompare(b.songs.title));
    if (sortBy === 'title_desc') return [...result].sort((a, b) => b.songs.title.localeCompare(a.songs.title));
    return result;
  }, [songs, sortBy, filterQuery]);

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
  const canDrag = canEdit && sortBy === 'custom' && !filterQuery.trim();

  return (
    <>
      <Stack.Screen
        options={{
          title: set.name,
          headerTintColor: '#d97706',
          headerRight: () => (
            <View className="flex-row gap-4">
              {canEdit && (
                <TouchableOpacity onPress={() => setSettingsVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="settings-outline" size={20} color="#64748b" />
                </TouchableOpacity>
              )}
              {isOwner && (
                <TouchableOpacity onPress={confirmDeleteSet} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          ),
        }}
      />

      <AddSongModal
        visible={addModalVisible}
        existingIds={existingIds}
        onClose={() => setAddModalVisible(false)}
        onAdded={handleSongAdded}
      />

      <SetSettingsModal
        visible={settingsVisible}
        setId={id}
        isOwner={isOwner}
        linkSharing={set.link_sharing ?? 'private'}
        collaborators={collaborators}
        onClose={() => setSettingsVisible(false)}
        onSharingChange={handleSharingChange}
        onCollaboratorAdded={(c) => setCollaborators(prev => [...prev, c])}
        onCollaboratorRemoved={(cid) => setCollaborators(prev => prev.filter(c => c.id !== cid))}
      />

      <View className="flex-1 bg-white">
        {set.description ? (
          <View className="px-4 py-3 border-b border-slate-100">
            <Text className="text-slate-500 text-sm">{set.description}</Text>
          </View>
        ) : null}

        {/* Sort tabs + filter */}
        {songs.length > 0 && (
          <View className="px-4 pt-2 pb-2 border-b border-slate-100">
            <View className="flex-row items-center bg-slate-100 rounded-xl px-3 py-2 mb-2">
              <Ionicons name="search" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
              <TextInput
                className="flex-1 text-slate-900 text-sm"
                placeholder="Filter songs…"
                placeholderTextColor="#94a3b8"
                value={filterQuery}
                onChangeText={setFilterQuery}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {filterQuery.length > 0 && (
                <TouchableOpacity onPress={() => setFilterQuery('')}>
                  <Text className="text-slate-400 ml-2">✕</Text>
                </TouchableOpacity>
              )}
            </View>
            <View className="flex-row gap-2">
              {(['custom', 'title_asc', 'title_desc'] as SetSortOrder[]).map(key => (
                <TouchableOpacity
                  key={key}
                  onPress={() => setSortBy(key)}
                  className={`px-3 py-1 rounded-full border ${sortBy === key ? 'bg-amber-500 border-amber-500' : 'bg-white border-slate-200'}`}
                >
                  <Text className={`text-xs font-medium ${sortBy === key ? 'text-white' : 'text-slate-600'}`}>
                    {key === 'custom' ? 'Custom' : key === 'title_asc' ? 'A → Z' : 'Z → A'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {songs.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20 px-8">
            <Text className="text-slate-900 font-semibold mb-1">No songs yet</Text>
            <Text className="text-slate-400 text-sm text-center">
              {canEdit ? 'Tap "Add Song" to start building this set.' : 'This set has no songs yet.'}
            </Text>
          </View>
        ) : canDrag ? (
          <DraggableFlatList
            data={songs}
            keyExtractor={(item) => item.id}
            onDragEnd={({ data }) => handleReorder(data)}
            contentContainerStyle={{ paddingBottom: canEdit ? 140 : 40 }}
            renderItem={({ item, drag, isActive, getIndex }: RenderItemParams<SetSong>) => (
              <ScaleDecorator>
                <SongRow
                  song={item}
                  canEdit={canEdit}
                  displayPosition={(getIndex() ?? 0) + 1}
                  drag={drag}
                  isActive={isActive}
                  myUserId={myUserId}
                  onRemove={() => handleRemoveSong(item.id)}
                  onKeyChange={(key) => handleKeyChange(item.id, key)}
                  onLeaderToggle={(newIds) => handleLeaderToggle(item.id, newIds)}
                  onTogglePlayed={() => handleTogglePlayed(item.id, !item.played)}
                />
              </ScaleDecorator>
            )}
          />
        ) : (
          <FlatList
            data={displayedSongs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: canEdit ? 140 : 40 }}
            ListEmptyComponent={
              <View className="items-center justify-center py-16 px-8">
                <Text className="text-slate-400 text-sm">No songs match this filter</Text>
              </View>
            }
            renderItem={({ item, index }) => (
              <SongRow
                song={item}
                canEdit={canEdit}
                displayPosition={index + 1}
                myUserId={myUserId}
                onRemove={() => handleRemoveSong(item.id)}
                onKeyChange={(key) => handleKeyChange(item.id, key)}
                onLeaderToggle={(newIds) => handleLeaderToggle(item.id, newIds)}
                onTogglePlayed={() => handleTogglePlayed(item.id, !item.played)}
              />
            )}
          />
        )}

        {canEdit ? (
          <View className="absolute bottom-0 left-0 right-0 px-4 pb-8 pt-2 bg-white border-t border-slate-100">
            {isOwner && (
              <TouchableOpacity
                onPress={spotifyExporting ? undefined : handleSpotifyExport}
                disabled={spotifyExporting}
                className="flex-row items-center justify-center gap-2 py-2.5 mb-2 rounded-xl border border-slate-200"
              >
                {spotifyExporting ? (
                  <ActivityIndicator size="small" color="#1db954" />
                ) : (
                  <Ionicons name="musical-notes-outline" size={16} color="#1db954" />
                )}
                <Text className="text-slate-700 text-sm font-medium">
                  {set.spotify_playlist_id
                    ? (spotifyExporting ? 'Syncing…' : 'Sync Spotify playlist')
                    : (spotifyExporting ? 'Exporting…' : 'Export to Spotify')}
                </Text>
                {set.spotify_playlist_id && !spotifyExporting ? (
                  <Ionicons name="open-outline" size={13} color="#94a3b8" />
                ) : null}
              </TouchableOpacity>
            )}
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
