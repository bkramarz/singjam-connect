import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { supabase } from '@/lib/supabase';

const RESERVED = new Set(['admin', 'support', 'help', 'singjam', 'sing', 'jam', 'connect', 'api', 'www', 'mail']);
const USERNAME_RE = /^[a-zA-Z0-9_]+$/;

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

type Props = {
  title: string;
  subtitle: string;
  submitLabel: string;
  onSave: () => void;
};

export default function ProfileForm({ title, subtitle, submitLabel, onSave }: Props) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [singing, setSinging] = useState<Set<string>>(new Set());
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userId = useRef<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userId.current = user.id;
      const { data } = await supabase
        .from('profiles')
        .select('display_name, last_name, username, singing_voice')
        .eq('id', user.id)
        .single();
      if (data?.display_name) setFirstName(data.display_name);
      if (data?.last_name) setLastName(data.last_name);
      if (data?.username) setUsername(data.username);
      if (data?.singing_voice) setSinging(new Set(data.singing_voice.split(',').filter(Boolean)));
    }
    load();
  }, []);

  function handleUsernameChange(val: string) {
    setUsername(val);
    setUsernameStatus('idle');
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    if (val.length < 3) return;
    if (!USERNAME_RE.test(val)) { setUsernameStatus('invalid'); return; }
    if (RESERVED.has(val.toLowerCase())) { setUsernameStatus('taken'); return; }
    usernameTimer.current = setTimeout(() => checkUsername(val), 400);
  }

  async function checkUsername(val: string) {
    setUsernameStatus('checking');
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', val.toLowerCase())
      .neq('id', userId.current ?? '')
      .maybeSingle();
    setUsernameStatus(data ? 'taken' : 'available');
  }

  function toggleSinging(voice: string) {
    setSinging(prev => {
      const next = new Set(prev);
      if (next.has(voice)) next.delete(voice);
      else next.add(voice);
      return next;
    });
  }

  async function handleSave() {
    setError(null);
    if (!firstName.trim()) { setError('First name is required.'); return; }
    if (username.length < 3) { setError('Username must be at least 3 characters.'); return; }
    if (!USERNAME_RE.test(username)) { setError('Username can only contain letters, numbers, and underscores.'); return; }
    if (usernameStatus === 'taken' || usernameStatus === 'invalid') { setError('Please choose a valid username.'); return; }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');

    const [{ error: saveError }] = await Promise.all([
      supabase.from('profiles').upsert({
        id: user.id,
        display_name: firstName.trim(),
        last_name: lastName.trim() || null,
        username: username.toLowerCase().trim(),
        singing_voice: Array.from(singing).join(',') || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' }),
      supabase.auth.updateUser({ data: { name: firstName.trim(), full_name: fullName } }),
    ]);

    setSaving(false);
    if (saveError) { setError(saveError.message); return; }
    onSave();
  }

  const usernameHint = {
    idle: null,
    checking: 'Checking…',
    available: '✓ Available',
    taken: '✗ Already taken',
    invalid: 'Letters, numbers, and underscores only',
  }[usernameStatus];

  const usernameHintColor =
    usernameStatus === 'available' ? 'text-green-600' :
    usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'text-red-500' :
    'text-slate-400';

  return (
    <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        <View className="px-6 pt-16 pb-10">
          <Text className="text-3xl font-bold text-slate-900 mb-1">{title}</Text>
          <Text className="text-slate-400 mb-8">{subtitle}</Text>

          {/* Name row */}
          <View className="flex-row mb-4">
            <View className="flex-1 mr-2">
              <Text className="text-sm font-medium text-slate-700 mb-1">First name</Text>
              <TextInput
                className="border border-slate-200 rounded-xl px-4 py-3 text-slate-900"
                placeholder="Jane"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
              />
            </View>
            <View className="flex-1 ml-2">
              <Text className="text-sm font-medium text-slate-700 mb-1">Last name</Text>
              <TextInput
                className="border border-slate-200 rounded-xl px-4 py-3 text-slate-900"
                placeholder="Smith"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Username */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-slate-700 mb-1">Username</Text>
            <View className="flex-row items-center border border-slate-200 rounded-xl px-4 py-3">
              <Text className="text-slate-400 mr-1">@</Text>
              <TextInput
                className="flex-1 text-slate-900"
                placeholder="yourname"
                value={username}
                onChangeText={handleUsernameChange}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {usernameStatus === 'checking' && <ActivityIndicator size="small" color="#94a3b8" />}
            </View>
            {usernameHint ? (
              <Text className={`text-xs mt-1 ${usernameHintColor}`}>{usernameHint}</Text>
            ) : null}
          </View>

          {/* Singing voice */}
          <View className="mb-8">
            <Text className="text-sm font-medium text-slate-700 mb-2">Singing</Text>
            <View className="flex-row mb-3">
              {(['lead', 'backup'] as const).map((voice, i) => {
                const active = singing.has(voice);
                return (
                  <TouchableOpacity
                    key={voice}
                    onPress={() => toggleSinging(voice)}
                    className={`flex-1 rounded-xl py-3 items-center border ${i === 0 ? 'mr-2' : 'ml-2'} ${
                      active ? 'bg-amber-500 border-amber-500' : 'bg-white border-slate-200'
                    }`}
                  >
                    <Text className={`font-medium text-sm ${active ? 'text-white' : 'text-slate-600'}`}>
                      {voice === 'lead' ? 'Lead vocals' : 'Backup vocals'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              onPress={() => setSinging(new Set())}
              className={`rounded-xl py-3 items-center border ${
                singing.size === 0 ? 'bg-slate-100 border-slate-200' : 'bg-white border-slate-200'
              }`}
            >
              <Text className={`font-medium text-sm ${singing.size === 0 ? 'text-slate-700' : 'text-slate-400'}`}>
                I don't sing
              </Text>
            </TouchableOpacity>
          </View>

          {error ? <Text className="text-red-500 text-sm mb-3">{error}</Text> : null}

          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            className="bg-amber-500 rounded-xl py-4 items-center"
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">{submitLabel}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
