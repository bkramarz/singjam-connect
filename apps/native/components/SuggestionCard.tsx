import { View, Text, TouchableOpacity, Alert, ActionSheetIOS, Platform } from 'react-native';
import { formatComposers } from '@singjam/core';

export type Suggestion = {
  song_id: string;
  title: string;
  display_artist: string | null;
  first_line: string | null;
  slug: string | null;
  composers: string[];
  cultures: string[];
  productions: string[];
  genres: string[];
  languages: string[];
  year: number | null;
  popularity: number;
  youtube_id: string | null;
  spotify_track_id: string | null;
};

type Props = {
  song: Suggestion;
  canLead: boolean;
  onAdd: (confidence: string) => void;
  onView: () => void;
};

// Mirrors web's "Songs you might know" SongCard: title + (songwriters),
// production/artist line, jammer count, and an Add control whose Lead option
// is gated on the user being a singer (same rule as the repertoire cards).
export default function SuggestionCard({ song, canLead, onAdd, onView }: Props) {
  function handleAddTap() {
    const leadLabel = canLead ? 'Lead' : 'Lead (singers only)';
    const options = [leadLabel, 'Support', 'Learn', 'Cancel'];
    const values = ['lead', 'support', 'learn'];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 3,
          title: `Add "${song.title}" as…`,
          disabledButtonIndices: canLead ? [] : [0],
        },
        (index) => { if (index < 3) onAdd(values[index]); }
      );
    } else {
      Alert.alert('Add as…', song.title, [
        ...(canLead ? [{ text: 'Lead', onPress: () => onAdd('lead') }] : []),
        { text: 'Support', onPress: () => onAdd('support') },
        { text: 'Learn', onPress: () => onAdd('learn') },
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  }

  const composersLabel = song.composers.length > 0
    ? formatComposers(song.composers, song.cultures)
    : null;

  return (
    <View className="mx-4 mb-2 rounded-md border border-zinc-200 bg-white p-4">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 min-w-0 mr-3">
          <TouchableOpacity onPress={onView}>
            <Text numberOfLines={2}>
              <Text className="font-medium text-slate-900">{song.title}</Text>
              {composersLabel ? (
                <Text className="text-slate-400"> ({composersLabel})</Text>
              ) : null}
            </Text>
          </TouchableOpacity>
          <Text className="text-sm text-slate-500 mt-0.5" numberOfLines={1}>
            {song.productions.length > 0 ? (
              <>from <Text className="italic">{song.productions.join(', ')}</Text></>
            ) : (
              song.display_artist ?? '—'
            )}
          </Text>
          {song.popularity > 0 && (
            <Text className="text-xs text-zinc-400 mt-0.5">
              {song.popularity} {song.popularity === 1 ? 'jammer' : 'jammers'}
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={handleAddTap}
          className="rounded-full bg-amber-500 px-3.5 py-1.5"
        >
          <Text className="text-sm font-medium text-white">Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
