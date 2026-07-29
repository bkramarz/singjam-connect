import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import ContentContainer from '@/components/ContentContainer';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://singjam.org';

// Mirrors web's /feedback page (apps/web/app/feedback/page.tsx): posts a bug
// report to /api/feedback, which emails music@singjam.org. Sends a Bearer token
// so the report is attributed to the signed-in user, just like on web.
export default function FeedbackScreen() {
  const router = useRouter();
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!description.trim()) return;
    setBusy(true);
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session) headers.Authorization = `Bearer ${session.access_token}`;

    try {
      const res = await fetch(`${WEB_URL}/api/feedback`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          description,
          steps,
          page: `Native app (${Platform.OS})`,
        }),
      });
      if (res.ok) setDone(true);
      else setError('Something went wrong. Please try again.');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <>
        <Stack.Screen options={{ title: 'Report a bug', headerTintColor: '#d97706' }} />
        <ContentContainer style={{ backgroundColor: 'white' }}>
        <View className="flex-1 bg-white px-4 pt-8">
          <Text className="text-xl font-semibold text-zinc-900">Thanks for the report!</Text>
          <Text className="mt-2 text-sm text-zinc-500">
            We'll look into it and follow up if we need more details.
          </Text>
          <TouchableOpacity onPress={() => router.back()} className="mt-4">
            <Text className="text-sm font-medium text-amber-600">← Go back</Text>
          </TouchableOpacity>
        </View>
        </ContentContainer>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Report a bug', headerTintColor: '#d97706' }} />
      <ContentContainer style={{ backgroundColor: 'white' }}>
      <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
          <View className="px-4 pt-6 pb-10">
            <Text className="text-sm text-zinc-500 mb-5">Tell us what went wrong and we'll get it fixed.</Text>

            <View className="mb-4">
              <Text className="text-sm font-medium text-zinc-700 mb-1">
                What happened? <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                className="border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900"
                placeholder="Describe the bug…"
                placeholderTextColor="#a1a1aa"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                style={{ minHeight: 100, textAlignVertical: 'top' }}
                autoFocus
                autoCapitalize="sentences"
              />
            </View>

            <View className="mb-6">
              <Text className="text-sm font-medium text-zinc-700 mb-1">
                Steps to reproduce <Text className="font-normal text-zinc-400">(optional)</Text>
              </Text>
              <TextInput
                className="border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900"
                placeholder="What were you doing when it happened?"
                placeholderTextColor="#a1a1aa"
                value={steps}
                onChangeText={setSteps}
                multiline
                numberOfLines={3}
                style={{ minHeight: 80, textAlignVertical: 'top' }}
                autoCapitalize="sentences"
              />
            </View>

            {error ? <Text className="text-red-500 text-sm mb-3">{error}</Text> : null}

            <TouchableOpacity
              onPress={submit}
              disabled={busy || !description.trim()}
              className={`rounded-xl py-4 items-center ${description.trim() ? 'bg-amber-500' : 'bg-zinc-200'}`}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className={`font-semibold text-base ${description.trim() ? 'text-white' : 'text-zinc-400'}`}>
                  Send report
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      </ContentContainer>
    </>
  );
}
