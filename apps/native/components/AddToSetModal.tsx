import { useState, useEffect } from 'react';
import {
  View, Text, Modal, TouchableOpacity, FlatList, ActivityIndicator, Alert,
} from 'react-native';
import { supabase } from '@/lib/supabase';

type UserSet = {
  id: string;
  name: string;
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

    const { data } = await supabase
      .from('sets')
      .select('id, name')
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    setSets((data ?? []).map((s: any) => ({ id: s.id, name: s.name })));
    setLoading(false);
  }

  async function handleAdd(setId: string) {
    setPending(setId);

    const { data: existing } = await supabase
      .from('set_songs')
      .select('position')
      .eq('set_id', setId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextPosition = (existing?.position ?? 0) + 1;

    for (const song of songs) {
      const { error } = await supabase
        .from('set_songs')
        .insert({ set_id: setId, song_id: song.id, position: nextPosition, leader_user_ids: [] });
      if (error && !error.message.includes('duplicate')) {
        Alert.alert('Error', error.message);
        setPending(null);
        return;
      }
      nextPosition++;
    }

    setPending(null);
    setAdded(prev => new Set([...prev, setId]));
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-white">
        <View className="flex-row items-center px-4 pt-4 pb-3 border-b border-slate-100">
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text className="text-amber-600 font-medium">Done</Text>
          </TouchableOpacity>
          <Text className="flex-1 text-center font-semibold text-slate-900">Add to Set</Text>
          <View style={{ width: 50 }} />
        </View>

        <View className="px-4 py-2 bg-slate-50 border-b border-slate-100">
          <Text className="text-slate-500 text-sm" numberOfLines={1}>
            {songs.length === 1 ? `"${songs[0].title}"` : `${songs.length} songs selected`}
          </Text>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#d97706" />
          </View>
        ) : sets.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-slate-900 font-semibold mb-1">No sets yet</Text>
            <Text className="text-slate-400 text-sm text-center">
              Create a set from the Sets tab to organise songs.
            </Text>
          </View>
        ) : (
          <FlatList
            data={sets}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}
            renderItem={({ item }) => {
              const isAdded = added.has(item.id);
              const isPending = pending === item.id;
              return (
                <View className="mx-4 mb-2 rounded-xl border border-slate-100 bg-white px-4 py-3 flex-row items-center">
                  <Text className="flex-1 font-semibold text-slate-900 mr-3" numberOfLines={1}>
                    {item.name}
                  </Text>
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
