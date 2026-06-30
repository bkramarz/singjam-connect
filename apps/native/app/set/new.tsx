import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { data, error: insertError } = await supabase
      .from('sets')
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        owner_user_id: user.id,
      })
      .select('id')
      .single();

    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    router.replace({ pathname: '/set/[id]' as any, params: { id: data.id } });
  }

  return (
    <>
      <Stack.Screen options={{ title: 'New Set', headerTintColor: '#d97706' }} />
      <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
          <View className="px-4 pt-6 pb-10">
            <View className="mb-4">
              <Text className="text-sm font-medium text-slate-700 mb-1">Set name</Text>
              <TextInput
                className="border border-slate-200 rounded-xl px-4 py-3 text-slate-900"
                placeholder="e.g. Friday night gig"
                value={name}
                onChangeText={setName}
                autoFocus
                autoCapitalize="sentences"
              />
            </View>

            <View className="mb-6">
              <Text className="text-sm font-medium text-slate-700 mb-1">
                Description <Text className="font-normal text-slate-400">(optional)</Text>
              </Text>
              <TextInput
                className="border border-slate-200 rounded-xl px-4 py-3 text-slate-900"
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
              className={`rounded-xl py-4 items-center ${name.trim() ? 'bg-amber-500' : 'bg-slate-200'}`}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className={`font-semibold text-base ${name.trim() ? 'text-white' : 'text-slate-400'}`}>
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
