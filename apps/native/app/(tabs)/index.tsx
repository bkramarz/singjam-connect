import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { fetchUserSongs, matchesSearch, type UserSong } from '@singjam/core';
import { supabase } from '@/lib/supabase';
import SongRow from '@/components/SongRow';
import AddSongModal from '@/components/AddSongModal';

function SkeletonRow() {
  return (
    <View className="px-4 py-3 border-b border-slate-100">
      <View className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
      <View className="h-3 bg-slate-100 rounded w-1/2" />
    </View>
  );
}

export default function RepertoireScreen() {
  const [songs, setSongs] = useState<UserSong[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    try {
      const data = await fetchUserSongs(supabase, user.id);
      setSongs(data);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return songs;
    return songs.filter((s) =>
      matchesSearch([s.title, s.display_artist ?? ''].join(' '), query)
    );
  }, [songs, query]);

  const existingIds = useMemo(() => new Set(songs.map((s) => s.song_id)), [songs]);

  async function handleConfidenceChange(songId: string, confidence: string) {
    setSongs((prev) =>
      prev.map((s) => (s.song_id === songId ? { ...s, confidence } : s))
    );
    const { error } = await supabase
      .from('user_songs')
      .update({ confidence })
      .eq('user_id', userId)
      .eq('song_id', songId);
    if (error) {
      Alert.alert('Error', error.message);
      load();
    }
  }

  async function handleRemove(songId: string) {
    setSongs((prev) => prev.filter((s) => s.song_id !== songId));
    const { error } = await supabase
      .from('user_songs')
      .delete()
      .eq('user_id', userId)
      .eq('song_id', songId);
    if (error) {
      Alert.alert('Error', error.message);
      load();
    }
  }

  function handleAdded() {
    setShowAdd(false);
    load();
  }

  const renderItem = useCallback(
    ({ item }: { item: UserSong }) => (
      <SongRow
        song={item}
        onConfidenceChange={handleConfidenceChange}
        onRemove={handleRemove}
      />
    ),
    [userId]
  );

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-14 pb-3 border-b border-slate-100">
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

      {/* Search */}
      <View className="px-4 py-2 border-b border-slate-100">
        <View className="flex-row items-center bg-slate-100 rounded-xl px-3 py-2">
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
      </View>

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
          keyExtractor={(item) => item.song_id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#d97706"
            />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center pt-24">
              <Text className="text-slate-400 text-base">
                {query.trim() ? 'No songs match your search' : 'Your repertoire is empty'}
              </Text>
              {!query.trim() && (
                <TouchableOpacity onPress={() => setShowAdd(true)} className="mt-4">
                  <Text className="text-amber-600 font-medium">Add your first song</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
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
    </View>
  );
}
