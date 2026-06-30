import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
} from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

type Notification = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

type Section = { key: string; title: string; data: Notification[] };

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function SkeletonRow() {
  return (
    <View className="px-4 py-4 border-b border-slate-100">
      <View className="h-4 w-2/3 bg-slate-200 rounded mb-2" />
      <View className="h-3 w-1/2 bg-slate-100 rounded" />
    </View>
  );
}

function NotifRow({ notif, onPress }: { notif: Notification; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`px-4 py-4 border-b border-slate-100 flex-row items-start ${notif.read ? '' : 'bg-amber-50'}`}
    >
      <View className="flex-1">
        <View className="flex-row items-center mb-0.5">
          {!notif.read && (
            <View className="w-2 h-2 rounded-full bg-amber-500 mr-2 mt-1 flex-shrink-0" />
          )}
          <Text className={`font-semibold text-slate-900 flex-1 ${notif.read ? '' : 'text-slate-900'}`} numberOfLines={2}>
            {notif.title}
          </Text>
        </View>
        {notif.body ? (
          <Text className="text-sm text-slate-500 mt-0.5 ml-4" numberOfLines={2}>{notif.body}</Text>
        ) : null}
        <Text className="text-xs text-slate-400 mt-1 ml-4">{timeAgo(notif.created_at)}</Text>
      </View>
      {notif.link ? (
        <Ionicons name="chevron-forward" size={14} color="#94a3b8" className="mt-1" />
      ) : null}
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); setRefreshing(false); return; }

    const [unreadRes, readRes] = await Promise.all([
      supabase
        .from('notifications')
        .select('id, title, body, link, read, created_at')
        .eq('user_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false }),
      supabase
        .from('notifications')
        .select('id, title, body, link, read, created_at')
        .eq('user_id', user.id)
        .eq('read', true)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const built: Section[] = [];
    if ((unreadRes.data ?? []).length > 0) {
      built.push({ key: 'new', title: 'New', data: unreadRes.data ?? [] });
    }
    if ((readRes.data ?? []).length > 0) {
      built.push({ key: 'earlier', title: 'Earlier', data: readRes.data ?? [] });
    }

    setSections(built);
    setLoading(false);
    setRefreshing(false);

    // Mark all unread as read
    if ((unreadRes.data ?? []).length > 0) {
      const ids = (unreadRes.data ?? []).map(n => n.id);
      await supabase
        .from('notifications')
        .update({ read: true })
        .in('id', ids);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function handlePress(notif: Notification) {
    if (!notif.link) return;
    // Internal links like /jam/abc or /set/abc
    const link = notif.link;
    if (link.startsWith('/jam/')) {
      router.push({ pathname: '/jam/[id]' as any, params: { id: link.replace('/jam/', '') } });
    } else if (link.startsWith('/set/')) {
      router.push({ pathname: '/set/[id]' as any, params: { id: link.replace('/set/', '') } });
    }
  }

  const allItems = sections.flatMap(s => [
    { type: 'header' as const, key: `h_${s.key}`, title: s.title },
    ...s.data.map(n => ({ type: 'notif' as const, key: n.id, notif: n })),
  ]);

  return (
    <>
      <Stack.Screen options={{ title: 'Notifications', headerTintColor: '#d97706' }} />
      <View className="flex-1 bg-white">
        {loading ? (
          <View>
            {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
          </View>
        ) : allItems.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="notifications-off-outline" size={40} color="#cbd5e1" />
            <Text className="text-slate-900 font-semibold mt-3">No notifications</Text>
            <Text className="text-slate-400 text-sm text-center mt-1">
              Jam invites and other activity will appear here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={allItems}
            keyExtractor={item => item.key}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#d97706" />
            }
            renderItem={({ item }) => {
              if (item.type === 'header') {
                return (
                  <View className="px-4 pt-4 pb-1 bg-slate-50 border-b border-slate-100">
                    <Text className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      {item.title}
                    </Text>
                  </View>
                );
              }
              return <NotifRow notif={item.notif} onPress={() => handlePress(item.notif)} />;
            }}
          />
        )}
      </View>
    </>
  );
}
