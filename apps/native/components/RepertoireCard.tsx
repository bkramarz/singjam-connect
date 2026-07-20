import { View, Text, TouchableOpacity, Alert, ActionSheetIOS, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatComposers } from '@singjam/core';

const CONFIDENCE_LEVELS = [
  { key: 'lead', label: 'Lead' },
  { key: 'support', label: 'Support' },
  { key: 'learn', label: 'Learn' },
];

export type RepertoireCardSong = {
  song_id: string;
  title: string;
  confidence: string;
  display_artist: string | null;
  composers: string[];
  cultures: string[];
  productions: string[];
  popularity: number;
};

type Props = {
  song: RepertoireCardSong;
  selected: boolean;
  canLead: boolean;
  isLast: boolean;
  onToggleSelect: () => void;
  onConfidenceChange: (confidence: string) => void;
  onAddToSet: () => void;
  onView: () => void;
  onRemove: () => void;
};

// Mirrors the repertoire row card in web's repertoire/page.tsx: checkbox,
// title + (songwriters), production/artist line, jammer count, then a
// confidence control + Add to set / View / Remove actions.
export default function RepertoireCard({
  song, selected, canLead, isLast,
  onToggleSelect, onConfidenceChange, onAddToSet, onView, onRemove,
}: Props) {
  function handleConfidenceTap() {
    const leadLabel = canLead ? 'Lead' : 'Lead (singers only)';
    const options = [leadLabel, 'Support', 'Learn', 'Cancel'];
    const values = ['lead', 'support', 'learn'];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 3,
          title: song.title,
          disabledButtonIndices: canLead ? [] : [0],
        },
        (index) => { if (index < 3) onConfidenceChange(values[index]); }
      );
    } else {
      Alert.alert('Role', song.title, [
        ...(canLead ? [{ text: 'Lead', onPress: () => onConfidenceChange('lead') }] : []),
        { text: 'Support', onPress: () => onConfidenceChange('support') },
        { text: 'Learn', onPress: () => onConfidenceChange('learn') },
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  }

  function handleRemoveTap() {
    Alert.alert('Remove song', `Remove "${song.title}" from your repertoire?`, [
      { text: 'Remove', style: 'destructive', onPress: onRemove },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  const composersLabel = song.composers.length > 0
    ? formatComposers(song.composers, song.cultures)
    : null;
  const confidenceLabel = CONFIDENCE_LEVELS.find(l => l.key === song.confidence)?.label ?? 'Learn';
  const isLead = song.confidence === 'lead';

  return (
    <View
      className={`mx-4 border-x border-b border-zinc-200 p-4 ${isLast ? 'rounded-b-md' : ''} ${
        selected ? 'bg-amber-50' : 'bg-white'
      }`}
    >
      <View className="flex-row items-start">
        <TouchableOpacity
          onPress={onToggleSelect}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="mt-0.5 mr-3"
        >
          <Ionicons
            name={selected ? 'checkbox' : 'square-outline'}
            size={20}
            color={selected ? '#d97706' : '#d4d4d8'}
          />
        </TouchableOpacity>

        <View className="flex-1 min-w-0">
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
      </View>

      <View className="flex-row flex-wrap items-center gap-2 mt-3 ml-8">
        <TouchableOpacity
          onPress={handleConfidenceTap}
          className={`flex-row items-center rounded-xl border px-2.5 py-1.5 ${
            isLead ? 'border-amber-400 bg-amber-100' : 'border-zinc-200 bg-white'
          }`}
        >
          <Text className={`text-sm ${isLead ? 'text-amber-800 font-semibold' : 'text-slate-700'}`}>
            {confidenceLabel}
          </Text>
          <Ionicons name="chevron-down" size={12} color={isLead ? '#92400e' : '#71717a'} style={{ marginLeft: 4 }} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onAddToSet}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5"
        >
          <Text className="text-sm text-zinc-600">Add to set</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onView}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5"
        >
          <Text className="text-sm text-zinc-600">View</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleRemoveTap}
          className="rounded-xl border border-zinc-200 bg-white px-2 py-1"
        >
          <Text className="text-xs text-zinc-400">Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
