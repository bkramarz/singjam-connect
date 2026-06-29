import { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ActionSheetIOS,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { supabase } from '@/lib/supabase';

type SearchResult = {
  song_id: string;
  title: string;
  display_artist: string | null;
};

type Props = {
  visible: boolean;
  userId: string;
  existingIds: Set<string>;
  onClose: () => void;
  onAdded: (songId: string, confidence: string) => void;
};

export default function AddSongModal({ visible, userId, existingIds, onClose, onAdded }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

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

  function pickConfidence(song: SearchResult) {
    const options = ['Lead', 'Support', 'Learn', 'Cancel'];
    const values = ['lead', 'support', 'learn'];

    const add = async (confidence: string) => {
      setPendingId(song.song_id);
      const { error } = await supabase.from('user_songs').upsert(
        { user_id: userId, song_id: song.song_id, confidence, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,song_id' }
      );
      setPendingId(null);
      if (error) { Alert.alert('Error', error.message); return; }
      onAdded(song.song_id, confidence);
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 3, title: 'Add "' + song.title + '" as…' },
        (index) => { if (index < 3) add(values[index]); }
      );
    } else {
      Alert.alert('Add as…', song.title, [
        { text: 'Lead', onPress: () => add('lead') },
        { text: 'Support', onPress: () => add('support') },
        { text: 'Learn', onPress: () => add('learn') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  const renderItem = useCallback(({ item }: { item: SearchResult }) => {
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
            onPress={() => pickConfidence(item)}
            className="bg-amber-500 rounded-full px-3 py-1"
          >
            <Text className="text-white text-sm font-medium">Add</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [existingIds, pendingId]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View className="flex-row items-center px-4 pt-4 pb-2 border-b border-slate-100">
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text className="text-amber-600 font-medium">Cancel</Text>
          </TouchableOpacity>
          <Text className="flex-1 text-center font-semibold text-slate-900">Add a Song</Text>
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
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
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
            data={results}
            keyExtractor={(item) => item.song_id}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
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
