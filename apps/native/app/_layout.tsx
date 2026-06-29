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
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialised(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
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
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) router.replace('/(auth)');
    if (session && inAuthGroup) router.replace('/(tabs)');
  }, [session, initialised, segments]);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
    </Stack>
  );
}
