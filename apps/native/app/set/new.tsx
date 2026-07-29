import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://singjam.org';

export default function NewSetScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSaving(false); return; }

    // Created through the web API rather than a direct insert so both apps share
    // one creation path (and the jam-linked collaborator fan-out it performs).
    const res = await fetch(`${WEB_URL}/api/sets`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
      }),
    }).catch(() => null);

    setSaving(false);
    if (!res?.ok) {
      const json = await res?.json().catch(() => null);
      setError(json?.error ?? 'Something went wrong creating this set.');
      return;
    }

    const { id } = await res.json();
    router.replace({ pathname: '/set/[id]' as any, params: { id } });
  }

  return (
    <>
      <Stack.Screen options={{ title: 'New Set', headerTintColor: '#d97706' }} />
      <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
          <View className="px-4 pt-6 pb-10">
            <View className="mb-4">
              <Text className="text-sm font-medium text-zinc-700 mb-1">Set name</Text>
              <TextInput
                className="border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900"
                placeholder="e.g. Friday night gig"
                value={name}
                onChangeText={setName}
                autoFocus
                autoCapitalize="sentences"
              />
            </View>

            <View className="mb-6">
              <Text className="text-sm font-medium text-zinc-700 mb-1">
                Description <Text className="font-normal text-zinc-400">(optional)</Text>
              </Text>
              <TextInput
                className="border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900"
                placeholder="e.g. Acoustic set for the pub"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                style={{ minHeight: 80, textAlignVertical: 'top' }}
                autoCapitalize="sentences"
              />
            </View>

            {error ? <Text className="text-red-500 text-sm mb-3">{error}</Text> : null}

            <TouchableOpacity
              onPress={handleCreate}
              disabled={saving || !name.trim()}
              className={`rounded-xl py-4 items-center ${name.trim() ? 'bg-amber-500' : 'bg-zinc-200'}`}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className={`font-semibold text-base ${name.trim() ? 'text-white' : 'text-zinc-400'}`}>
                  Create Set
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
