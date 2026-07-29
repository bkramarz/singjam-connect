import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { countActiveFilters, type SongFilterState, type SongFilterOptions } from '@singjam/core';

// The facet filter sheet for both the Song Library and Repertoire screens —
// native's counterpart to web's single `FilterPanel`, which `/search` and
// `/repertoire` likewise share. Web renders it inline; on a phone it's a sheet.
//
// Generic over the caller's filter state so a screen can carry extra fields
// alongside the shared dimensions (Song Library keeps `sortBy` in the same
// object) and have them preserved through edits and Clear.

export function emptyFilterDimensions(): SongFilterState {
  return {
    genres: new Set(),
    cultures: new Set(),
    languages: new Set(),
    themes: new Set(),
    vibe: '',
    tonality: '',
    meter: '',
    yearMin: '',
    yearMax: '',
  };
}

export function toggleFilterValue(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  next.has(value) ? next.delete(value) : next.add(value);
  return next;
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`px-3 py-1.5 rounded-full border mr-2 mb-2 ${selected ? 'bg-amber-500 border-amber-500' : 'bg-white border-zinc-200'}`}
    >
      <Text className={`text-sm font-medium ${selected ? 'text-white' : 'text-zinc-600'}`}>{label}</Text>
    </TouchableOpacity>
  );
}

function SectionLabel({ title }: { title: string }) {
  return <Text className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2 mt-4">{title}</Text>;
}

export default function SongFilterSheet<T extends SongFilterState>({
  visible,
  filters,
  options,
  yearBounds,
  emptyHint,
  onChange,
  onClose,
}: {
  visible: boolean;
  filters: T;
  options: SongFilterOptions;
  yearBounds: { min: number | null; max: number | null };
  // Shown when the pool has no facets to offer at all — only reachable on
  // Repertoire, where the pool is the user's own (possibly tiny) song list.
  emptyHint?: { title: string; detail: string };
  onChange: (f: T) => void;
  onClose: () => void;
}) {
  const activeCount = countActiveFilters(filters);

  function set(patch: Partial<SongFilterState>) {
    onChange({ ...filters, ...patch });
  }

  const hasAnyOption =
    options.genres.length > 0 ||
    options.cultures.length > 0 ||
    options.languages.length > 0 ||
    options.themes.length > 0 ||
    options.vibes.length > 0 ||
    options.tonalities.length > 0 ||
    options.meters.length > 0 ||
    yearBounds.min != null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-white">
        <View className="flex-row items-center px-4 pt-4 pb-3 border-b border-zinc-100">
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text className="text-amber-600 font-medium">Done</Text>
          </TouchableOpacity>
          <Text className="flex-1 text-center font-semibold text-zinc-900">Filters</Text>
          <TouchableOpacity
            onPress={() => onChange({ ...filters, ...emptyFilterDimensions() })}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            disabled={activeCount === 0}
          >
            <Text className={`font-medium ${activeCount > 0 ? 'text-red-500' : 'text-zinc-300'}`}>Clear</Text>
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 40 }}>
          {options.genres.length > 0 && (
            <>
              <SectionLabel title="Genre" />
              <View className="flex-row flex-wrap">
                {options.genres.map(g => <Chip key={g} label={g} selected={filters.genres.has(g)} onPress={() => set({ genres: toggleFilterValue(filters.genres, g) })} />)}
              </View>
            </>
          )}
          {options.cultures.length > 0 && (
            <>
              <SectionLabel title="Culture" />
              <View className="flex-row flex-wrap">
                {options.cultures.map(c => <Chip key={c} label={c} selected={filters.cultures.has(c)} onPress={() => set({ cultures: toggleFilterValue(filters.cultures, c) })} />)}
              </View>
            </>
          )}
          {options.languages.length > 0 && (
            <>
              <SectionLabel title="Language" />
              <View className="flex-row flex-wrap">
                {options.languages.map(l => <Chip key={l} label={l} selected={filters.languages.has(l)} onPress={() => set({ languages: toggleFilterValue(filters.languages, l) })} />)}
              </View>
            </>
          )}
          {options.themes.length > 0 && (
            <>
              <SectionLabel title="Theme" />
              <View className="flex-row flex-wrap">
                {options.themes.map(t => <Chip key={t} label={t} selected={filters.themes.has(t)} onPress={() => set({ themes: toggleFilterValue(filters.themes, t) })} />)}
              </View>
            </>
          )}
          {options.vibes.length > 0 && (
            <>
              <SectionLabel title="Vibe" />
              <View className="flex-row flex-wrap">
                {options.vibes.map(v => <Chip key={v} label={v} selected={filters.vibe === v} onPress={() => set({ vibe: filters.vibe === v ? '' : v })} />)}
              </View>
            </>
          )}
          {options.tonalities.length > 0 && (
            <>
              <SectionLabel title="Tonality" />
              <View className="flex-row flex-wrap">
                {options.tonalities.map(t => <Chip key={t} label={t} selected={filters.tonality === t} onPress={() => set({ tonality: filters.tonality === t ? '' : t })} />)}
              </View>
            </>
          )}
          {options.meters.length > 0 && (
            <>
              <SectionLabel title="Meter" />
              <View className="flex-row flex-wrap">
                {options.meters.map(m => <Chip key={m} label={m} selected={filters.meter === m} onPress={() => set({ meter: filters.meter === m ? '' : m })} />)}
              </View>
            </>
          )}
          {yearBounds.min != null && (
            <>
              <SectionLabel title="Year" />
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <TextInput
                  className="flex-1 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900"
                  placeholder={String(yearBounds.min)}
                  placeholderTextColor="#a1a1aa"
                  keyboardType="number-pad"
                  maxLength={4}
                  value={filters.yearMin}
                  onChangeText={t => set({ yearMin: t.replace(/[^0-9]/g, '') })}
                />
                <Text className="text-zinc-400">–</Text>
                <TextInput
                  className="flex-1 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900"
                  placeholder={yearBounds.max != null ? String(yearBounds.max) : 'To'}
                  placeholderTextColor="#a1a1aa"
                  keyboardType="number-pad"
                  maxLength={4}
                  value={filters.yearMax}
                  onChangeText={t => set({ yearMax: t.replace(/[^0-9]/g, '') })}
                />
              </View>
            </>
          )}
          {!hasAnyOption && emptyHint && (
            <View className="items-center pt-16">
              <Text className="text-zinc-400 text-sm">{emptyHint.title}</Text>
              <Text className="text-zinc-400 text-sm mt-1">{emptyHint.detail}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
