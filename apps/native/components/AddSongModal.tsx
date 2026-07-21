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
import { useRouter } from 'expo-router';
import { formatComposers } from '@singjam/core';
import { supabase } from '@/lib/supabase';
import SubmitMissingSong from '@/components/SubmitMissingSong';

type SearchResult = {
  song_id: string;
  title: string;
  display_artist: string | null;
  composers: string[];
  cultures: string[];
  productions: string[];
  popularity: number;
};

type Props = {
  visible: boolean;
  userId: string;
  existingIds: Set<string>;
  canLead: boolean;
  onClose: () => void;
  onAdded: (songId: string, confidence: string) => void;
};

export default function AddSongModal({ visible, userId, existingIds, canLead, onClose, onAdded }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) { setQuery(''); setResults([]); }
  }, [visible]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(() => search(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  async function search(q: string) {
    setSearching(true);
    // Ranked full-text search (matches title, artist, composers, aka) — same
    // RPC web's add-song search uses, instead of a raw title/artist ilike.
    const { data } = await supabase.rpc('search_songs', { q, limit_n: 30 });
    setResults((data ?? []) as SearchResult[]);
    setSearching(false);
  }

  function pickConfidence(song: SearchResult) {
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

    // "Lead" is gated on the user being a singer, same rule as the repertoire
    // cards and SuggestionCard.
    if (Platform.OS === 'ios') {
      const leadLabel = canLead ? 'Lead' : 'Lead (singers only)';
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [leadLabel, 'Support', 'Learn', 'Cancel'],
          cancelButtonIndex: 3,
          title: `Add "${song.title}" as…`,
          disabledButtonIndices: canLead ? [] : [0],
        },
        (index) => { if (index < 3) add(values[index]); }
      );
    } else {
      Alert.alert('Add as…', song.title, [
        ...(canLead ? [{ text: 'Lead', onPress: () => add('lead') }] : []),
        { text: 'Support', onPress: () => add('support') },
        { text: 'Learn', onPress: () => add('learn') },
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  }

  const renderItem = useCallback(({ item }: { item: SearchResult }) => {
    const already = existingIds.has(item.song_id);
    const pending = pendingId === item.song_id;
    const composersLabel = item.composers?.length > 0
      ? formatComposers(item.composers, item.cultures)
      : null;
    return (
      <View className="flex-row items-center px-4 py-3 border-b border-slate-100">
        <View className="flex-1 mr-3">
          <Text numberOfLines={2}>
            <Text className="text-slate-900 font-medium">{item.title}</Text>
            {composersLabel ? <Text className="text-slate-400"> ({composersLabel})</Text> : null}
          </Text>
          <Text className="text-slate-400 text-sm mt-0.5" numberOfLines={1}>
            {item.productions?.length > 0 ? (
              <>from <Text className="italic">{item.productions.join(', ')}</Text></>
            ) : (
              item.display_artist ?? '—'
            )}
          </Text>
          {item.popularity > 0 && (
            <Text className="text-xs text-zinc-400 mt-0.5">
              {item.popularity} {item.popularity === 1 ? 'jammer' : 'jammers'}
            </Text>
          )}
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
  }, [existingIds, pendingId, canLead]);

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
              placeholder="Search by title, artist, or songwriter…"
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
              query.trim().length > 0 && !searching ? (
                <View className="pt-8">
                  <Text className="text-center text-slate-400">No songs found</Text>
                  <SubmitMissingSong
                    defaultTitle={query.trim()}
                    onCreated={(songId) => { onClose(); router.push(`/song/${songId}` as any); }}
                  />
                </View>
              ) : null
            }
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}
