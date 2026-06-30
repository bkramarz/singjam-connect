import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, RefreshControl, Alert, ScrollView } from 'react-native';
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

type ConfidenceFilter = 'all' | 'lead' | 'support' | 'learn';
type SortOrder = 'title_asc' | 'title_desc' | 'recent';

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
];

export default function RepertoireScreen() {
  const [songs, setSongs] = useState<UserSong[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('title_asc');
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
    let result = songs;
    if (query.trim()) {
      result = result.filter(s =>
        matchesSearch([s.title, s.display_artist ?? ''].join(' '), query)
      );
    }
    if (confidenceFilter !== 'all') {
      result = result.filter(s => s.confidence === confidenceFilter);
    }
    if (sortOrder === 'title_desc') {
      result = [...result].sort((a, b) => b.title.localeCompare(a.title));
    } else if (sortOrder === 'recent') {
      result = [...result].sort((a, b) => {
        if (!a.updated_at && !b.updated_at) return 0;
        if (!a.updated_at) return 1;
        if (!b.updated_at) return -1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
    }
    return result;
  }, [songs, query, confidenceFilter, sortOrder]);

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
      <View className="px-4 pt-2 pb-1 border-b border-slate-100">
        <View className="flex-row items-center bg-slate-100 rounded-xl px-3 py-2 mb-2">
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

        {/* Confidence filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-1.5">
          <View className="flex-row gap-2 pb-1">
            {CONFIDENCE_CHIPS.map(chip => (
              <TouchableOpacity
                key={chip.key}
                onPress={() => setConfidenceFilter(chip.key)}
                className={`px-3 py-1 rounded-full border ${confidenceFilter === chip.key ? 'bg-amber-500 border-amber-500' : 'bg-white border-slate-200'}`}
              >
                <Text className={`text-sm font-medium ${confidenceFilter === chip.key ? 'text-white' : 'text-slate-600'}`}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            ))}
            <View className="w-px bg-slate-200 mx-1" />
            {SORT_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setSortOrder(opt.key)}
                className={`px-3 py-1 rounded-full border ${sortOrder === opt.key ? 'bg-slate-700 border-slate-700' : 'bg-white border-slate-200'}`}
              >
                <Text className={`text-sm font-medium ${sortOrder === opt.key ? 'text-white' : 'text-slate-500'}`}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
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
