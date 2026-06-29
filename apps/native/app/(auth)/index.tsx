import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: 'singjam://' } });
    if (error) setError(error.message);
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 justify-center px-6">
        <Text className="text-3xl font-bold text-slate-900 mb-2">SingJam</Text>
        <Text className="text-slate-500 mb-8">Find your next jam session.</Text>

        <TextInput
          className="border border-slate-200 rounded-lg px-4 py-3 mb-3 text-slate-900"
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          className={`border border-slate-200 rounded-lg px-4 py-3 text-slate-900 ${mode === 'signup' ? 'mb-3' : 'mb-4'}`}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {mode === 'signup' && (
          <TextInput
            className="border border-slate-200 rounded-lg px-4 py-3 mb-4 text-slate-900"
            placeholder="Confirm password"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        )}

        {error && <Text className="text-red-600 text-sm mb-3">{error}</Text>}

        <TouchableOpacity
          className="bg-amber-500 rounded-lg py-3 items-center mb-4"
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold">
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setConfirmPassword(''); setError(null); }}>
          <Text className="text-center text-slate-500 text-sm">
            {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
