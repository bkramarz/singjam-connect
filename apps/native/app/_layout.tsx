import '../global.css';

import * as Linking from 'expo-linking';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

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

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialised, setInitialised] = useState(false);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session) {
        const { data } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', session.user.id)
          .single();
        setProfileComplete(!!data?.display_name);
      }
      setInitialised(true);
    }
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) setProfileComplete(null);
    });

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
      subscription.unsubscribe();
      appStateSub.remove();
      linkingSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!initialised) return;

    const inAuth = segments[0] === '(auth)';
    const inSetup = segments[0] === 'setup';

    if (!session) {
      if (!inAuth) router.replace('/(auth)');
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
  }, [session, initialised, profileComplete, segments]);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="setup" options={{ headerShown: false }} />
      <Stack.Screen name="profile-edit" options={{ presentation: 'modal', title: 'Edit Profile', headerTintColor: '#d97706' }} />
      <Stack.Screen name="jam/[id]" options={{ headerTintColor: '#d97706' }} />
    </Stack>
  );
}
