import { View, Text, TouchableOpacity, Alert, ActionSheetIOS, Platform } from 'react-native';
import { formatComposers, type UserSong } from '@singjam/core';

const CONFIDENCE_LABELS: Record<string, string> = {
  lead: 'Lead',
  support: 'Support',
  learn: 'Learn',
};

const CONFIDENCE_STYLE: Record<string, string> = {
  lead: 'bg-amber-100 text-amber-700',
  support: 'bg-slate-100 text-slate-600',
  learn: 'bg-slate-100 text-slate-500',
};

type Props = {
  song: UserSong;
  onConfidenceChange: (songId: string, confidence: string) => void;
  onRemove: (songId: string) => void;
  onAddToSet?: (songId: string) => void;
  onPress?: () => void;
};

export default function SongRow({ song, onConfidenceChange, onRemove, onAddToSet, onPress }: Props) {
  const subtitle = [
    formatComposers(song.composers, song.cultures),
    song.display_artist,
  ]
    .filter(Boolean)
    .join(' · ');

  function handleConfidenceTap() {
    const options = onAddToSet
      ? ['Lead', 'Support', 'Learn', 'Add to set', 'Cancel']
      : ['Lead', 'Support', 'Learn', 'Cancel'];
    const values = ['lead', 'support', 'learn'];
    const cancelIndex = onAddToSet ? 4 : 3;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex, title: song.title },
        (index) => {
          if (index < 3) onConfidenceChange(song.song_id, values[index]);
          else if (onAddToSet && index === 3) onAddToSet(song.song_id);
        }
      );
    } else {
      Alert.alert('Song options', song.title, [
        { text: 'Lead', onPress: () => onConfidenceChange(song.song_id, 'lead') },
        { text: 'Support', onPress: () => onConfidenceChange(song.song_id, 'support') },
        { text: 'Learn', onPress: () => onConfidenceChange(song.song_id, 'learn') },
        ...(onAddToSet ? [{ text: 'Add to set', onPress: () => onAddToSet(song.song_id) }] : []),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  }

  function handleRemoveTap() {
    Alert.alert('Remove song', `Remove "${song.title}" from your repertoire?`, [
      { text: 'Remove', style: 'destructive', onPress: () => onRemove(song.song_id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  const badgeStyle = CONFIDENCE_STYLE[song.confidence] ?? CONFIDENCE_STYLE.learn;

  return (
    <View className="flex-row items-center px-4 py-3 border-b border-slate-100">
      <TouchableOpacity
        className="flex-1 mr-3"
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={onPress ? 0.6 : 1}
      >
        <Text className="text-slate-900 font-medium" numberOfLines={1}>
          {song.title}
        </Text>
        {subtitle ? (
          <Text className="text-slate-400 text-sm mt-0.5" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleConfidenceTap}
        className={`px-2 py-1 rounded-full mr-2 ${badgeStyle}`}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      >
        <Text className={`text-xs font-medium ${badgeStyle.split(' ')[1]}`}>
          {CONFIDENCE_LABELS[song.confidence] ?? 'Learn'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleRemoveTap}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text className="text-slate-300 text-lg leading-none">✕</Text>
      </TouchableOpacity>
    </View>
  );
}
