import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

type Mode = 'signin' | 'signup' | 'reset';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState<Mode>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setResetSent(false);
    setConfirmPassword('');
  }

  async function handleSubmit() {
    setError(null);

    if (mode === 'reset') {
      if (!email.trim()) { setError('Enter your email address.'); return; }
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'singjam://reset-password',
      });
      setLoading(false);
      if (error) { setError(error.message); return; }
      setResetSent(true);
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: 'singjam://' } });
    if (error) setError(error.message);
    setLoading(false);
  }

  if (mode === 'reset') {
    return (
      <KeyboardAvoidingView
        className="flex-1 bg-white"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="flex-1 justify-center px-6">
          <Text className="text-3xl font-bold text-slate-900 mb-2">Reset password</Text>
          <Text className="text-slate-500 mb-8">
            Enter your email and we'll send you a reset link.
          </Text>

          {resetSent ? (
            <View className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
              <Text className="text-green-800 font-medium mb-1">Check your inbox</Text>
              <Text className="text-green-700 text-sm">
                A reset link has been sent to {email}. Follow it to set a new password.
              </Text>
            </View>
          ) : (
            <>
              <TextInput
                className="border border-slate-200 rounded-lg px-4 py-3 mb-4 text-slate-900"
                placeholder="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                autoFocus
              />

              {error && <Text className="text-red-600 text-sm mb-3">{error}</Text>}

              <TouchableOpacity
                className="bg-amber-500 rounded-lg py-3 items-center mb-4"
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold">Send reset link</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity onPress={() => switchMode('signin')}>
            <Text className="text-center text-slate-500 text-sm">Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
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
          className={`border border-slate-200 rounded-lg px-4 py-3 text-slate-900 ${mode === 'signup' ? 'mb-3' : 'mb-1'}`}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {mode === 'signin' && (
          <TouchableOpacity
            onPress={() => switchMode('reset')}
            className="mb-4 self-end"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text className="text-sm text-amber-600">Forgot password?</Text>
          </TouchableOpacity>
        )}
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

        <TouchableOpacity onPress={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>
          <Text className="text-center text-slate-500 text-sm">
            {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
