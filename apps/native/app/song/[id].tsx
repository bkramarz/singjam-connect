import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Linking, Alert, ActionSheetIOS, Platform,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import AddToSetModal from '@/components/AddToSetModal';

// ── Types ─────────────────────────────────────────────────────────────────────

type RecordingArtist = {
  name: string;
  year: number | null;
  youtube_url: string | null;
  spotify_url: string | null;
};

type SongDetail = {
  id: string;
  title: string;
  display_artist: string | null;
  first_line: string | null;
  hook: string | null;
  notes: string | null;
  genius_url: string | null;
  chord_chart_url: string | null;
  youtube_url: string | null;
  year_written: number | null;
  tonality: string | null;
  meter: string | null;
  vibe: string | null;
  altTitles: string[];
  composers: string[];
  lyricists: string[];
  musicCultures: string[];
  lyricsCultures: string[];
  recordingArtists: RecordingArtist[];
  genres: string[];
  themes: string[];
  cultures: string[];
  languages: string[];
  productions: string[];
};

type JammerEntry = {
  userId: string;
  display_name: string | null;
  username: string | null;
};

type Jammers = {
  lead: JammerEntry[];
  support: JammerEntry[];
  learn: JammerEntry[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatComposersLong(names: string[], cultures: string[]): string {
  const isTraditional = names.some(n => n.toLowerCase() === 'traditional');
  const others = names.filter(n => n.toLowerCase() !== 'traditional');
  const parts: string[] = [];
  if (isTraditional) {
    const culture = cultures[0];
    parts.push(culture ? `Traditional — ${culture}` : 'Traditional');
  }
  parts.push(...others);
  return parts.join(', ');
}

function openUrl(url: string) {
  Linking.openURL(url).catch(() =>
    Alert.alert('Could not open link', 'Make sure you have a browser installed.')
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
      {title}
    </Text>
  );
}

function TagPill({ label }: { label: string }) {
  return (
    <View className="bg-slate-100 rounded-full px-3 py-1 mr-1.5 mb-1.5">
      <Text className="text-slate-600 text-sm">{label}</Text>
    </View>
  );
}

function TagRow({ label, tags }: { label: string; tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <View className="flex-row items-start mb-2">
      <Text className="text-xs font-medium text-slate-500 w-20 shrink-0 mt-1">{label}</Text>
      <View className="flex-1 flex-row flex-wrap">
        {tags.map(t => <TagPill key={t} label={t} />)}
      </View>
    </View>
  );
}

function JammerRow({ label, jammers, onTap }: {
  label: string;
  jammers: JammerEntry[];
  onTap: (userId: string) => void;
}) {
  if (jammers.length === 0) return null;
  return (
    <View className="flex-row items-start mb-2">
      <Text className="text-xs font-medium text-slate-500 w-16 shrink-0 mt-1">{label}</Text>
      <View className="flex-1 flex-row flex-wrap">
        {jammers.map(j => (
          <TouchableOpacity
            key={j.userId}
            onPress={() => onTap(j.userId)}
            className="bg-slate-100 rounded-full px-3 py-1 mr-1.5 mb-1.5"
          >
            <Text className="text-slate-600 text-sm">
              {j.display_name ?? (j.username ? `@${j.username}` : 'Unknown')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function SkeletonBlock({ w, h }: { w: string; h: number }) {
  return <View className={`${w} bg-slate-200 rounded`} style={{ height: h }} />;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SongDetailScreen() {
  const { id: songId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [song, setSong] = useState<SongDetail | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [myConfidence, setMyConfidence] = useState<string | null>(null);
  const [jammers, setJammers] = useState<Jammers | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [addToSetVisible, setAddToSetVisible] = useState(false);

  useEffect(() => {
    if (!songId) return;
    load();
  }, [songId]);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    setMyUserId(user?.id ?? null);

    const [songRes, confidenceRes, jammersRes] = await Promise.all([
      supabase
        .from('songs')
        .select(`
          id, title, display_artist, first_line, hook, notes,
          genius_url, chord_chart_url, youtube_url,
          year_written, tonality, meter, vibe,
          song_alternate_titles(title),
          song_composers(people(name)),
          song_lyricists(people(name)),
          song_cultures(context, cultures(name)),
          song_recording_artists(year, position, youtube_url, spotify_url, artists(name)),
          song_genres(genres(name)),
          song_themes(themes(name)),
          song_languages(languages(name)),
          song_productions(productions(name))
        `)
        .eq('id', songId)
        .single(),
      user
        ? supabase.from('user_songs').select('confidence')
            .eq('user_id', user.id).eq('song_id', songId).maybeSingle()
        : Promise.resolve({ data: null }),
      user
        ? supabase.from('user_songs')
            .select('confidence, user_id, profiles!user_id(id, display_name, username)')
            .eq('song_id', songId)
            .in('confidence', ['lead', 'support', 'learn'])
            .limit(50)
        : Promise.resolve({ data: null }),
    ]);

    if (!songRes.data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const s = songRes.data as any;
    const cultureRows: any[] = s.song_cultures ?? [];
    const musicRows = cultureRows.filter((x: any) => x.context === 'music');
    const lyricsRows = cultureRows.filter((x: any) => x.context === 'lyrics');
    const noCtx = cultureRows.filter((x: any) => !x.context);

    setSong({
      id: s.id,
      title: s.title ?? '',
      display_artist: s.display_artist ?? null,
      first_line: s.first_line ?? null,
      hook: s.hook ?? null,
      notes: s.notes ?? null,
      genius_url: s.genius_url ?? null,
      chord_chart_url: s.chord_chart_url ?? null,
      youtube_url: s.youtube_url ?? null,
      year_written: s.year_written ?? null,
      tonality: s.tonality ?? null,
      meter: s.meter ?? null,
      vibe: s.vibe ?? null,
      altTitles: (s.song_alternate_titles ?? []).map((x: any) => x.title).filter(Boolean),
      composers: (s.song_composers ?? []).map((x: any) => x.people?.name).filter(Boolean),
      lyricists: (s.song_lyricists ?? []).map((x: any) => x.people?.name).filter(Boolean),
      musicCultures: (musicRows.length ? musicRows : noCtx).map((x: any) => x.cultures?.name).filter(Boolean),
      lyricsCultures: (lyricsRows.length ? lyricsRows : noCtx).map((x: any) => x.cultures?.name).filter(Boolean),
      recordingArtists: (s.song_recording_artists ?? [])
        .map((x: any) => ({ name: x.artists?.name, year: x.year, position: x.position, youtube_url: x.youtube_url, spotify_url: x.spotify_url }))
        .filter((x: any) => x.name)
        .sort((a: any, b: any) => (a.position ?? 999) - (b.position ?? 999)),
      genres: (s.song_genres ?? []).map((x: any) => x.genres?.name).filter(Boolean).sort(),
      themes: (s.song_themes ?? []).map((x: any) => x.themes?.name).filter(Boolean).sort(),
      cultures: [...new Set((cultureRows).map((x: any) => x.cultures?.name).filter(Boolean) as string[])],
      languages: (s.song_languages ?? []).map((x: any) => x.languages?.name).filter(Boolean),
      productions: (s.song_productions ?? []).map((x: any) => x.productions?.name).filter(Boolean),
    });

    setMyConfidence((confidenceRes.data as any)?.confidence ?? null);

    if (jammersRes.data) {
      const lead: JammerEntry[] = [];
      const support: JammerEntry[] = [];
      const learn: JammerEntry[] = [];
      for (const row of jammersRes.data as any[]) {
        const entry = {
          userId: row.user_id,
          display_name: row.profiles?.display_name ?? null,
          username: row.profiles?.username ?? null,
        };
        if (row.confidence === 'lead') lead.push(entry);
        else if (row.confidence === 'support') support.push(entry);
        else learn.push(entry);
      }
      setJammers({ lead, support, learn });
    }

    setLoading(false);
  }

  async function handleAddToRepertoire() {
    if (!myUserId || !song) return;
    const options = ['Lead', 'Support', 'Learn', 'Cancel'];
    const values = ['lead', 'support', 'learn'];

    function upsert(confidence: string) {
      supabase.from('user_songs')
        .upsert({ user_id: myUserId, song_id: song.id, confidence }, { onConflict: 'user_id,song_id' })
        .then(({ error }) => {
          if (error) Alert.alert('Error', error.message);
          else setMyConfidence(confidence);
        });
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 3, title: 'Add to repertoire' },
        (i) => { if (i < 3) upsert(values[i]); }
      );
    } else {
      Alert.alert('Add to repertoire', undefined, [
        { text: 'Lead', onPress: () => upsert('lead') },
        { text: 'Support', onPress: () => upsert('support') },
        { text: 'Learn', onPress: () => upsert('learn') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  async function handleChangeConfidence() {
    if (!myUserId || !song) return;
    const options = ['Lead', 'Support', 'Learn', 'Remove from repertoire', 'Cancel'];
    const values = ['lead', 'support', 'learn'];

    function update(confidence: string) {
      supabase.from('user_songs')
        .update({ confidence })
        .eq('user_id', myUserId).eq('song_id', song.id)
        .then(({ error }) => {
          if (error) Alert.alert('Error', error.message);
          else setMyConfidence(confidence);
        });
    }

    function remove() {
      Alert.alert('Remove from repertoire', `Remove "${song.title}" from your repertoire?`, [
        {
          text: 'Remove', style: 'destructive', onPress: () => {
            supabase.from('user_songs')
              .delete().eq('user_id', myUserId!).eq('song_id', song.id)
              .then(({ error }) => {
                if (error) Alert.alert('Error', error.message);
                else setMyConfidence(null);
              });
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 4, destructiveButtonIndex: 3, title: song.title },
        (i) => {
          if (i < 3) update(values[i]);
          else if (i === 3) remove();
        }
      );
    } else {
      Alert.alert('Change role', song.title, [
        { text: 'Lead', onPress: () => update('lead') },
        { text: 'Support', onPress: () => update('support') },
        { text: 'Learn', onPress: () => update('learn') },
        { text: 'Remove', style: 'destructive', onPress: remove },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: '', headerTintColor: '#d97706' }} />
        <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 16, gap: 12 }}>
          <SkeletonBlock w="w-2/3" h={28} />
          <SkeletonBlock w="w-1/3" h={18} />
          <View style={{ height: 8 }} />
          <SkeletonBlock w="w-full" h={16} />
          <SkeletonBlock w="w-3/4" h={16} />
          <SkeletonBlock w="w-1/2" h={16} />
        </ScrollView>
      </>
    );
  }

  if (notFound || !song) {
    return (
      <>
        <Stack.Screen options={{ title: 'Song', headerTintColor: '#d97706' }} />
        <View className="flex-1 bg-white items-center justify-center">
          <Text className="text-slate-400">Song not found</Text>
        </View>
      </>
    );
  }

  const CONFIDENCE_LABEL: Record<string, string> = { lead: 'Lead', support: 'Support', learn: 'Learn' };
  const CONFIDENCE_STYLE: Record<string, string> = {
    lead: 'bg-amber-100 text-amber-700',
    support: 'bg-slate-100 text-slate-600',
    learn: 'bg-slate-100 text-slate-500',
  };
  const confStyle = myConfidence ? CONFIDENCE_STYLE[myConfidence] ?? CONFIDENCE_STYLE.learn : '';

  const tonalityPills = song.tonality ? song.tonality.split(',').map(s => s.trim()).filter(Boolean) : [];
  const meterPills = song.meter ? song.meter.split(',').map(s => s.trim()).filter(Boolean) : [];

  // Collect YouTube/Spotify links to surface
  const mediaLinks: { label: string; url: string; icon: 'logo-youtube' | 'musical-notes-outline' }[] = [];
  for (const ra of song.recordingArtists) {
    if (ra.youtube_url) {
      mediaLinks.push({ label: `${ra.name}${ra.year ? ` (${ra.year})` : ''} — YouTube`, url: ra.youtube_url, icon: 'logo-youtube' });
    }
    if (ra.spotify_url) {
      mediaLinks.push({ label: `${ra.name}${ra.year ? ` (${ra.year})` : ''} — Spotify`, url: ra.spotify_url, icon: 'musical-notes-outline' });
    }
  }
  if (mediaLinks.length === 0 && song.youtube_url) {
    mediaLinks.push({ label: 'Watch on YouTube', url: song.youtube_url, icon: 'logo-youtube' });
  }

  const hasMusicalProps = tonalityPills.length > 0 || meterPills.length > 0 || !!song.vibe;
  const hasTags = song.genres.length > 0 || song.themes.length > 0 || song.cultures.length > 0 || song.languages.length > 0;
  const hasJammers = jammers && (jammers.lead.length > 0 || jammers.support.length > 0 || jammers.learn.length > 0);

  return (
    <>
      <Stack.Screen options={{ title: '', headerTintColor: '#d97706' }} />

      {song && (
        <AddToSetModal
          visible={addToSetVisible}
          songId={song.id}
          songTitle={song.title}
          onClose={() => setAddToSetVisible(false)}
        />
      )}

      <ScrollView className="flex-1 bg-white" contentContainerStyle={{ paddingBottom: 60 }}>

        {/* Title + meta */}
        <View className="px-4 pt-5 pb-4 border-b border-slate-100">
          <Text className="text-2xl font-bold text-slate-900">{song.title}</Text>

          {song.productions.length > 0 ? (
            <Text className="text-base text-slate-500 mt-0.5">
              from <Text className="italic">{song.productions.join(', ')}</Text>
            </Text>
          ) : song.display_artist ? (
            <Text className="text-base text-slate-500 mt-0.5">{song.display_artist}</Text>
          ) : null}

          {song.altTitles.length > 0 ? (
            <Text className="text-sm text-slate-400 mt-1">aka: {song.altTitles.join(' · ')}</Text>
          ) : null}

          {song.year_written ? (
            <Text className="text-sm text-slate-400 mt-1">Written {song.year_written}</Text>
          ) : null}

          {/* Repertoire action */}
          <View className="flex-row flex-wrap items-center gap-2 mt-4">
            {myConfidence ? (
              <>
                <TouchableOpacity
                  onPress={handleChangeConfidence}
                  className={`px-4 py-2 rounded-full border ${confStyle.split(' ')[0]} border-transparent`}
                >
                  <Text className={`text-sm font-semibold ${confStyle.split(' ')[1]}`}>
                    {CONFIDENCE_LABEL[myConfidence]} ▾
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setAddToSetVisible(true)}
                  className="flex-row items-center gap-1 px-4 py-2 rounded-full border border-slate-200"
                >
                  <Ionicons name="list-outline" size={14} color="#64748b" />
                  <Text className="text-slate-600 text-sm font-medium">Add to set</Text>
                </TouchableOpacity>
              </>
            ) : myUserId ? (
              <TouchableOpacity
                onPress={handleAddToRepertoire}
                className="bg-amber-500 rounded-full px-4 py-2"
              >
                <Text className="text-white text-sm font-semibold">+ Add to repertoire</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Songwriters */}
        {(song.composers.length > 0 || song.lyricists.length > 0) ? (
          <View className="px-4 py-4 border-b border-slate-100">
            <SectionHeader title="Songwriters" />
            {song.composers.length > 0 ? (
              <Text className="text-sm text-slate-700 mb-1">
                <Text className="font-medium">Music: </Text>
                {formatComposersLong(song.composers, song.musicCultures)}
              </Text>
            ) : null}
            {song.lyricists.length > 0 ? (
              <Text className="text-sm text-slate-700">
                <Text className="font-medium">Lyrics: </Text>
                {formatComposersLong(song.lyricists, song.lyricsCultures)}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Recordings */}
        {song.recordingArtists.length > 0 ? (
          <View className="px-4 py-4 border-b border-slate-100">
            <SectionHeader title="Recordings" />
            <View className="flex-row flex-wrap">
              {song.recordingArtists.map((ra, i) => (
                <View key={i} className="bg-slate-100 rounded-full px-3 py-1 mr-1.5 mb-1.5 flex-row items-center gap-1.5">
                  <Text className="text-slate-700 text-sm">{ra.name}</Text>
                  {ra.year ? <Text className="text-slate-400 text-sm">{ra.year}</Text> : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Media links */}
        {mediaLinks.length > 0 ? (
          <View className="px-4 py-4 border-b border-slate-100">
            <SectionHeader title="Listen / Watch" />
            {mediaLinks.map((link, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => openUrl(link.url)}
                className="flex-row items-center py-2"
              >
                <Ionicons
                  name={link.icon}
                  size={18}
                  color={link.icon === 'logo-youtube' ? '#ef4444' : '#1db954'}
                  style={{ marginRight: 10 }}
                />
                <Text className="flex-1 text-slate-700 text-sm">{link.label}</Text>
                <Ionicons name="open-outline" size={14} color="#94a3b8" />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {/* Lyrics card */}
        {(song.first_line || song.hook || song.genius_url || song.chord_chart_url) ? (
          <View className="px-4 py-4 border-b border-slate-100">
            <SectionHeader title="Lyrics" />
            {song.first_line ? (
              <Text className="text-sm text-slate-700 mb-1">
                <Text className="font-medium text-slate-500">Opens: </Text>
                <Text className="italic">{song.first_line}</Text>
              </Text>
            ) : null}
            {song.hook ? (
              <Text className="text-sm text-slate-700 mb-3">
                <Text className="font-medium text-slate-500">Hook: </Text>
                <Text className="italic">{song.hook}</Text>
              </Text>
            ) : null}
            <View className="flex-row flex-wrap gap-2 mt-1">
              {song.genius_url ? (
                <TouchableOpacity
                  onPress={() => openUrl(song.genius_url!)}
                  className="flex-row items-center gap-1 border border-slate-200 rounded-xl px-4 py-2"
                >
                  <Text className="text-slate-600 text-sm font-medium">Full lyrics</Text>
                  <Ionicons name="open-outline" size={13} color="#94a3b8" />
                </TouchableOpacity>
              ) : null}
              {song.chord_chart_url ? (
                <TouchableOpacity
                  onPress={() => openUrl(song.chord_chart_url!)}
                  className="flex-row items-center gap-1 border border-slate-200 rounded-xl px-4 py-2"
                >
                  <Text className="text-slate-600 text-sm font-medium">Chord chart</Text>
                  <Ionicons name="open-outline" size={13} color="#94a3b8" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Musical properties */}
        {hasMusicalProps ? (
          <View className="px-4 py-4 border-b border-slate-100">
            <SectionHeader title="Musical properties" />
            <TagRow label="Tonality" tags={tonalityPills} />
            <TagRow label="Meter" tags={meterPills} />
            {song.vibe ? <TagRow label="Vibe" tags={[song.vibe]} /> : null}
          </View>
        ) : null}

        {/* Tags */}
        {hasTags ? (
          <View className="px-4 py-4 border-b border-slate-100">
            <SectionHeader title="Tags" />
            <TagRow label="Genres" tags={song.genres} />
            <TagRow label="Themes" tags={song.themes} />
            <TagRow label="Languages" tags={song.languages} />
            <TagRow label="Cultures" tags={song.cultures} />
          </View>
        ) : null}

        {/* Notes */}
        {song.notes ? (
          <View className="px-4 py-4 border-b border-slate-100">
            <SectionHeader title="Notes" />
            <Text className="text-sm text-slate-700 leading-relaxed">{song.notes}</Text>
          </View>
        ) : null}

        {/* Jammers */}
        {myUserId ? (
          <View className="px-4 py-4">
            <SectionHeader title="Jammers" />
            {!jammers ? (
              <ActivityIndicator size="small" color="#d97706" />
            ) : hasJammers ? (
              <>
                <JammerRow
                  label="Lead"
                  jammers={jammers.lead}
                  onTap={(userId) => router.push(`/profile/${userId}` as any)}
                />
                <JammerRow
                  label="Support"
                  jammers={jammers.support}
                  onTap={(userId) => router.push(`/profile/${userId}` as any)}
                />
                <JammerRow
                  label="Learn"
                  jammers={jammers.learn}
                  onTap={(userId) => router.push(`/profile/${userId}` as any)}
                />
              </>
            ) : (
              <Text className="text-sm text-slate-400">No jammers have added this song yet.</Text>
            )}
          </View>
        ) : null}

      </ScrollView>
    </>
  );
}
