import { useState, useEffect } from 'react';
import {
  View, Text, Modal, TouchableOpacity, FlatList, ActivityIndicator, Alert,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { setApi } from '@/lib/setApi';

type UserSet = {
  id: string;
  name: string;
  ownerName: string | null; // null when the current user owns the set
};

type SongEntry = { id: string; title: string };

type Props = {
  visible: boolean;
  songs: SongEntry[];
  onClose: () => void;
};

export default function AddToSetModal({ visible, songs, onClose }: Props) {
  const [sets, setSets] = useState<UserSet[]>([]);
  const [loading, setLoading] = useState(false);
  // Sets that already contain every selected song (loaded up front), plus any
  // added during this session — both render as a disabled "Added" state.
  const [inSets, setInSets] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setAdded(new Set());
    loadSets();
  }, [visible]);

  async function loadSets() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const songIds = songs.map((s) => s.id);

    // Sets the user can add to (owned + accepted collaborations) and, in
    // parallel, which sets already contain the selected song(s).
    const [ownedRes, collabRes, membershipRes] = await Promise.all([
      supabase
        .from('sets')
        .select('id, name')
        .eq('owner_user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('set_collaborators')
        .select('sets(id, name, owner_user_id, profiles!owner_user_id(display_name, last_name, username))')
        .eq('user_id', user.id)
        .eq('status', 'accepted'),
      supabase
        .from('set_songs')
        .select('set_id, song_id')
        .in('song_id', songIds),
    ]);

    const owned: UserSet[] = (ownedRes.data ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      ownerName: null,
    }));

    const ownedIds = new Set(owned.map((s) => s.id));
    const collaborating: UserSet[] = ((collabRes.data ?? []) as any[])
      .map((r) => r.sets)
      .filter(Boolean)
      .filter((s: any) => s.owner_user_id !== user.id && !ownedIds.has(s.id))
      .map((s: any) => ({
        id: s.id,
        name: s.name,
        ownerName:
          [s.profiles?.display_name, s.profiles?.last_name].filter(Boolean).join(' ') ||
          s.profiles?.username ||
          'Someone',
      }));

    // A set counts as "already added" only when it contains all selected songs
    // (for a single song this is just "the set has this song", like web).
    const bySet = new Map<string, Set<string>>();
    for (const row of (membershipRes.data ?? []) as any[]) {
      if (!bySet.has(row.set_id)) bySet.set(row.set_id, new Set());
      bySet.get(row.set_id)!.add(row.song_id);
    }
    const fullyIn = new Set<string>();
    for (const [setId, ids] of bySet) {
      if (songIds.every((id) => ids.has(id))) fullyIn.add(setId);
    }

    setSets([...owned, ...collaborating]);
    setInSets(fullyIn);
    setLoading(false);
  }

  async function handleAdd(setId: string) {
    // Mark the row added straight away — the common case is that it succeeds,
    // and a spinner per tap made adding to several sets feel like queuing.
    setPending(setId);
    setAdded(prev => new Set([...prev, setId]));

    // Through the web API, not a direct insert: set_songs' RLS only knows
    // owner/editor, so a co-owner writing straight to the table is rejected even
    // though they may add songs. The API is the one place that understands the
    // co-owner role, and it stamps added_by_user_id. Still one round-trip —
    // songIds adds the whole selection in a single request.
    const { ok, json } = await setApi(`/api/sets/${setId}/songs`, 'POST', {
      songIds: songs.map(s => s.id),
    });

    setPending(null);
    if (!ok) {
      Alert.alert('Error', json?.error ?? 'Could not add to that set.');
      setAdded(prev => {
        const next = new Set(prev);
        next.delete(setId);
        return next;
      });
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-white">
        <View className="flex-row items-center px-4 pt-4 pb-3 border-b border-zinc-100">
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text className="text-amber-600 font-medium">Done</Text>
          </TouchableOpacity>
          <Text className="flex-1 text-center font-semibold text-zinc-900">Add to Set</Text>
          <View style={{ width: 50 }} />
        </View>

        <View className="px-4 py-2 bg-zinc-50 border-b border-zinc-100">
          <Text className="text-zinc-500 text-sm" numberOfLines={1}>
            {songs.length === 1 ? `"${songs[0].title}"` : `${songs.length} songs selected`}
          </Text>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#d97706" />
          </View>
        ) : sets.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-zinc-900 font-semibold mb-1">No sets yet</Text>
            <Text className="text-zinc-400 text-sm text-center">
              Create a set from the Sets tab to organise songs.
            </Text>
          </View>
        ) : (
          <FlatList
            data={sets}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}
            renderItem={({ item }) => {
              const isAdded = added.has(item.id) || inSets.has(item.id);
              const isPending = pending === item.id;
              return (
                <View className="mx-4 mb-2 rounded-xl border border-zinc-100 bg-white px-4 py-3 flex-row items-center">
                  <View className="flex-1 mr-3">
                    <Text className="font-semibold text-zinc-900" numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.ownerName ? (
                      <Text className="text-xs text-zinc-400" numberOfLines={1}>Shared by {item.ownerName}</Text>
                    ) : null}
                  </View>
                  {isPending ? (
                    <ActivityIndicator size="small" color="#d97706" />
                  ) : isAdded ? (
                    <Text className="text-green-600 text-sm font-semibold">Added ✓</Text>
                  ) : (
                    <TouchableOpacity
                      onPress={() => handleAdd(item.id)}
                      className="bg-amber-500 rounded-full px-4 py-1.5"
                    >
                      <Text className="text-white text-sm font-semibold">Add</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}
