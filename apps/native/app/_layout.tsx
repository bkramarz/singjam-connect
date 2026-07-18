import '../global.css';

import * as Linking from 'expo-linking';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { supabase } from '@/lib/supabase';
import { AuthProvider, useAuth } from '@/lib/auth-context';

async function handleAuthDeepLink(url: string) {
  // Email confirmation links arrive as singjam://#access_token=...&refresh_token=...
  const fragment = url.split('#')[1];
  if (!fragment) return;
  const params = Object.fromEntries(new URLSearchParams(fragment));
  if (params.access_token && params.refresh_token) {
    await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
  }
}

function RootNavigator() {
  const { session, initialised, profileComplete, isGuest } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Refresh session when app returns to foreground (mirrors web's visibilitychange handler)
    const handleAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    };
    const appStateSub = AppState.addEventListener('change', handleAppStateChange);

    // Handle deep links for email confirmation (cold-start and warm-start)
    Linking.getInitialURL().then((url) => { if (url) handleAuthDeepLink(url); });
    const linkingSub = Linking.addEventListener('url', ({ url }) => handleAuthDeepLink(url));

    return () => {
      appStateSub.remove();
      linkingSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!initialised) return;

    const inAuth = segments[0] === '(auth)';
    const inSetup = segments[0] === 'setup';

    if (!session) {
      if (!inAuth && !isGuest) router.replace('/(auth)');
      return;
    }

    // Still fetching profile completeness — hold
    if (profileComplete === null) return;

    // Authenticated — decide where to go from auth/setup screens only
    // (once in tabs we don't redirect back to setup mid-session)
    if (inAuth || inSetup) {
      if (profileComplete) router.replace('/(tabs)');
      else if (!inSetup) router.replace('/setup');
    }
  }, [session, initialised, profileComplete, isGuest, segments]);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="setup" options={{ headerShown: false }} />
      <Stack.Screen name="profile-edit" options={{ presentation: 'modal', title: 'Edit Profile', headerTintColor: '#d97706' }} />
      <Stack.Screen name="account" options={{ presentation: 'modal', title: 'Account', headerTintColor: '#d97706' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications', headerTintColor: '#d97706' }} />
      <Stack.Screen name="profile/[id]" options={{ title: '', headerTintColor: '#d97706' }} />
      <Stack.Screen name="jam/[id]" options={{ headerTintColor: '#d97706' }} />
      <Stack.Screen name="jam/new" options={{ presentation: 'modal', title: 'New Jam', headerTintColor: '#d97706' }} />
      <Stack.Screen name="jam/edit" options={{ presentation: 'modal', title: 'Edit Jam', headerTintColor: '#d97706' }} />
      <Stack.Screen name="songs" options={{ title: 'Song Library', headerTintColor: '#d97706' }} />
      <Stack.Screen name="set/[id]" options={{ headerTintColor: '#d97706' }} />
      <Stack.Screen name="set/new" options={{ presentation: 'modal', title: 'New Set', headerTintColor: '#d97706' }} />
      <Stack.Screen name="song/[id]" options={{ headerTintColor: '#d97706' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
