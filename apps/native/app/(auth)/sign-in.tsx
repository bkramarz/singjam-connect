import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

type Mode = 'signin' | 'signup' | 'reset';

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

if (googleWebClientId) {
  GoogleSignin.configure({ webClientId: googleWebClientId, iosClientId: googleIosClientId });
}

async function completeAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  fetch(`${process.env.EXPO_PUBLIC_WEB_URL}/api/auth/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({}),
  }).catch(() => {});
}

export default function SignInScreen() {
  const { mode: initialMode } = useLocalSearchParams<{ mode?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState<Mode>(initialMode === 'signup' ? 'signup' : 'signin');
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

  async function handleAppleSignIn() {
    setError(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('No identity token returned from Apple.');
      setLoading(true);
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      setLoading(false);
      if (error) { setError(error.message); return; }
      completeAuth();
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') setError(e.message ?? 'Apple sign-in failed.');
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return;
      const idToken = response.data.idToken;
      if (!idToken) throw new Error('No ID token returned from Google.');
      setLoading(true);
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      setLoading(false);
      if (error) { setError(error.message); return; }
      completeAuth();
    } catch (e) {
      if (isErrorWithCode(e)) {
        if (e.code !== statusCodes.SIGN_IN_CANCELLED) setError('Google sign-in failed.');
      } else {
        setError('Google sign-in failed.');
      }
    }
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
      <View className="flex-1 px-6 pt-6">
        <View className="items-center mb-8">
          <Image
            source={require('../../assets/icon.png')}
            className="w-14 h-14 rounded-2xl"
          />
          <Text className="text-xl font-bold text-slate-900 mt-2">SingJam</Text>
        </View>
        <Text className="text-3xl font-bold text-slate-900 mb-2">
          {mode === 'signin' ? 'Welcome back' : 'Create your account'}
        </Text>
        <Text className="text-slate-500 mb-8 leading-5">
          <Text className="font-semibold text-slate-700">Discover new music</Text> and{' '}
          <Text className="font-semibold text-slate-700">new friends</Text>. Totally{' '}
          <Text className="font-semibold text-slate-700">free</Text> — we'll only email you about{' '}
          <Text className="font-semibold text-slate-700">cool music stuff</Text> 😎 🎸🥁
        </Text>

        {googleWebClientId && (
          <TouchableOpacity
            className="flex-row items-center justify-center gap-2.5 border border-slate-200 rounded-lg py-3 mb-3"
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            <Ionicons name="logo-google" size={18} color="#4285F4" />
            <Text className="text-slate-700 font-medium">Continue with Google</Text>
          </TouchableOpacity>
        )}

        {Platform.OS === 'ios' && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={8}
            style={{ width: '100%', height: 44, marginBottom: 16 }}
            onPress={handleAppleSignIn}
          />
        )}

        {(googleWebClientId || Platform.OS === 'ios') && (
          <View className="flex-row items-center gap-3 mb-4">
            <View className="h-px flex-1 bg-slate-200" />
            <Text className="text-xs text-slate-400">or</Text>
            <View className="h-px flex-1 bg-slate-200" />
          </View>
        )}

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
