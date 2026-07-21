import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://singjam.org';

// Mirrors web's SubmitSongForm: posts a missing song to /api/songs/submit,
// which enriches it server-side (MusicBrainz/Spotify) and adds it to the
// library. Simplified for mobile — no interactive Spotify preview step; the
// server does its own lookup. On success (or if it already exists) we hand the
// new song's id back so the caller can open it.
export default function SubmitMissingSong({
  defaultTitle = '',
  onCreated,
}: {
  defaultTitle?: string;
  onCreated: (songId: string) => void;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [artist, setArtist] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setBusy(false); setError('Sign in to add a song.'); return; }

    try {
      const res = await fetch(`${WEB_URL}/api/songs/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ title: title.trim(), artist: artist.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      // 409 means it already exists — still hand back the id so we open it.
      if (res.ok || (res.status === 409 && json.id)) {
        onCreated(json.id);
        return;
      }
      setError(json.error ?? 'Something went wrong. Please try again.');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="mx-4 mt-4 rounded-2xl border border-slate-200 bg-white p-4">
      <Text className="font-semibold text-slate-900">Add a missing song</Text>
      <Text className="mt-0.5 text-xs text-slate-500">
        We'll look it up and add it to the library so you can add it to your repertoire.
      </Text>

      <View className="mt-3">
        <Text className="text-sm font-medium text-slate-700 mb-1">
          Song title <Text className="text-red-500">*</Text>
        </Text>
        <TextInput
          className="border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
          placeholder="e.g. Proud Mary"
          placeholderTextColor="#94a3b8"
          value={title}
          onChangeText={t => { setTitle(t); setError(null); }}
          editable={!busy}
          autoCapitalize="words"
        />
      </View>

      <View className="mt-3">
        <Text className="text-sm font-medium text-slate-700 mb-1">
          Recording artist <Text className="font-normal text-slate-400">(optional)</Text>
        </Text>
        <TextInput
          className="border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
          placeholder="e.g. Creedence Clearwater Revival"
          placeholderTextColor="#94a3b8"
          value={artist}
          onChangeText={t => { setArtist(t); setError(null); }}
          editable={!busy}
          autoCapitalize="words"
        />
      </View>

      {error ? <Text className="text-red-500 text-sm mt-2">{error}</Text> : null}

      <TouchableOpacity
        onPress={submit}
        disabled={busy || !title.trim()}
        className={`mt-3 rounded-xl py-3 items-center ${title.trim() ? 'bg-amber-500' : 'bg-slate-200'}`}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className={`font-semibold ${title.trim() ? 'text-white' : 'text-slate-400'}`}>Add song</Text>
        )}
      </TouchableOpacity>
      {busy ? (
        <Text className="text-xs text-slate-400 text-center mt-2">Looking up song info — this can take a few seconds…</Text>
      ) : null}
    </View>
  );
}
