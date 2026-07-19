import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

// Mirrors the web mobile header (apps/web/app/layout.tsx + MobileHeaderProfile):
// slate-900 bar, amber logo tile + wordmark, search + notification bell,
// amber Sign in pill for guests.
export default function BrandHeader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const [unread, setUnread] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (!session) { setUnread(0); return; }
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('read', false)
        .then(({ count }) => { if (!cancelled) setUnread(count ?? 0); });
      return () => { cancelled = true; };
    }, [session])
  );

  return (
    <View className="bg-slate-900" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between px-4 py-3">
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <View className="h-8 w-8 items-center justify-center rounded-lg bg-amber-500">
            <Ionicons name="musical-notes" size={16} color="white" />
          </View>
          <Text className="text-sm font-semibold text-white">SingJam</Text>
        </View>

        <View className="flex-row items-center" style={{ gap: 4 }}>
          <TouchableOpacity
            onPress={() => router.push('/songs' as any)}
            className="h-9 w-9 items-center justify-center rounded-lg"
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            accessibilityLabel="Search songs"
          >
            <Ionicons name="search" size={20} color="#cbd5e1" />
          </TouchableOpacity>

          {session ? (
            <TouchableOpacity
              onPress={() => router.push('/notifications' as any)}
              className="h-9 w-9 items-center justify-center rounded-lg"
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={20} color="#cbd5e1" />
              {unread > 0 && (
                <View className="absolute right-0.5 top-0.5 h-4 w-4 items-center justify-center rounded-full bg-amber-500">
                  <Text className="text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</Text>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => router.push('/(auth)/sign-in' as any)}
              className="rounded-lg bg-amber-500 px-3 py-1.5"
            >
              <Text className="text-xs font-semibold text-white">Sign in</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}
