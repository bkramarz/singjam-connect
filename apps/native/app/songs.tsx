import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  ActivityIndicator, ActionSheetIOS, Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';

type Song = {
  song_id: string;
  title: string;
  display_artist: string | null;
  popularity?: number;
};

function SkeletonRow() {
  return (
    <View className="px-4 py-3 border-b border-slate-100">
      <View className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
      <View className="h-3 bg-slate-100 rounded w-1/3" />
    </View>
  );
}

export default function SongLibraryScreen() {
  const [query, setQuery] = useState('');
  const [popular, setPopular] = useState<Song[]>([]);
  const [results, setResults] = useState<Song[]>([]);
  const [myIds, setMyIds] = useState<Set<string>>(new Set());
  const [loadingPopular, setLoadingPopular] = useState(true);
  const [searching, setSearching] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [songsRes, popularityRes, myRes] = await Promise.all([
        supabase.from('songs').select('song_id:id, title, display_artist').order('title').limit(500),
        supabase.rpc('song_popularity_counts'),
        supabase.from('user_songs').select('song_id').eq('user_id', user.id),
      ]);

      setMyIds(new Set((myRes.data ?? []).map((r: any) => r.song_id)));

      const countMap = new Map<string, number>(
        ((popularityRes.data ?? []) as { song_id: string; user_count: number }[])
          .map(r => [r.song_id, Number(r.user_count)])
      );

      const sorted: Song[] = ((songsRes.data ?? []) as Song[])
        .map(s => ({ ...s, popularity: countMap.get(s.song_id) ?? 0 }))
        .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0) || a.title.localeCompare(b.title));

      setPopular(sorted);
      setLoadingPopular(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!query.trim()) { setResults([]); return; }
    setSearching(true);
    timer.current = setTimeout(async () => {
      const { data } = await supabase.rpc('search_songs', { q: query.trim(), limit_n: 50 });
      setResults(
        ((data ?? []) as any[]).map(r => ({
          song_id: r.song_id,
          title: r.title,
          display_artist: r.display_artist ?? null,
        }))
      );
      setSearching(false);
    }, 250);
  }, [query]);

  async function addSong(song: Song, confidence: string) {
    if (!userId) return;
    setPendingId(song.song_id);
    const { error } = await supabase.from('user_songs').upsert(
      { user_id: userId, song_id: song.song_id, confidence, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,song_id' }
    );
    setPendingId(null);
    if (error) { Alert.alert('Error', error.message); return; }
    setMyIds(prev => new Set([...prev, song.song_id]));
  }

  function handleAdd(song: Song) {
    const values = ['lead', 'support', 'learn'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Lead', 'Support', 'Learn', 'Cancel'], cancelButtonIndex: 3, title: `Add "${song.title}" as…` },
        index => { if (index < 3) addSong(song, values[index]); }
      );
    } else {
      Alert.alert('Add as…', song.title, [
        { text: 'Lead', onPress: () => addSong(song, 'lead') },
        { text: 'Support', onPress: () => addSong(song, 'support') },
        { text: 'Learn', onPress: () => addSong(song, 'learn') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  const renderItem = useCallback(({ item }: { item: Song }) => {
    const added = myIds.has(item.song_id);
    const pending = pendingId === item.song_id;
    return (
      <View className="flex-row items-center px-4 py-3 border-b border-slate-100">
        <View className="flex-1 mr-3">
          <Text className="text-slate-900 font-medium" numberOfLines={1}>{item.title}</Text>
          {item.display_artist ? (
            <Text className="text-slate-400 text-sm mt-0.5" numberOfLines={1}>{item.display_artist}</Text>
          ) : null}
        </View>
        {added ? (
          <Text className="text-slate-400 text-sm">Added</Text>
        ) : pending ? (
          <ActivityIndicator size="small" color="#d97706" />
        ) : (
          <TouchableOpacity
            onPress={() => handleAdd(item)}
            className="bg-amber-500 rounded-full px-3 py-1"
          >
            <Text className="text-white text-sm font-medium">Add</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [myIds, pendingId]);

  const isSearching = query.trim().length > 0;
  const data = isSearching ? results : popular;

  return (
    <>
      <Stack.Screen options={{ title: 'Song Library', headerTintColor: '#d97706' }} />
      <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        <View className="px-4 py-3 border-b border-slate-100">
          <View className="flex-row items-center bg-slate-100 rounded-xl px-3 py-2">
            <Text className="text-slate-400 mr-2">🔍</Text>
            <TextInput
              className="flex-1 text-slate-900"
              placeholder="Search by title, artist, or composer…"
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

        {!isSearching && !loadingPopular && (
          <View className="px-4 py-2 bg-slate-50 border-b border-slate-100">
            <Text className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Popular songs</Text>
          </View>
        )}

        {loadingPopular && !isSearching ? (
          <FlatList
            data={Array(10).fill(null)}
            keyExtractor={(_, i) => String(i)}
            renderItem={() => <SkeletonRow />}
            scrollEnabled={false}
          />
        ) : searching ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#d97706" />
          </View>
        ) : (
          <FlatList
            data={data}
            keyExtractor={item => item.song_id}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              isSearching ? (
                <View className="items-center pt-16">
                  <Text className="text-slate-400">No songs found</Text>
                </View>
              ) : null
            }
          />
        )}
      </KeyboardAvoidingView>
    </>
  );
}
