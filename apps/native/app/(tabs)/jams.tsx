import { useState, useCallback } from 'react';
import { View, Text, SectionList, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import JamCard, { type JamItem } from '@/components/JamCard';

type Section = { title: string; data: JamItem[] };

function SkeletonCard() {
  return (
    <View className="flex-row px-4 py-3 border-b border-slate-100">
      <View className="w-12 h-16 bg-slate-200 rounded-lg mr-3" />
      <View className="flex-1 justify-center gap-2">
        <View className="h-4 bg-slate-200 rounded w-3/4" />
        <View className="h-3 bg-slate-100 rounded w-1/2" />
        <View className="h-3 bg-slate-100 rounded w-2/3" />
      </View>
    </View>
  );
}

export default function JamsScreen() {
  const [sections, setSections] = useState<Section[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [jamsResult, rsvpsResult, invitesResult] = await Promise.all([
      supabase
        .from('jams')
        .select(`
          id, name, visibility, starts_at, ends_at, timezone,
          neighborhood, notes, image_url, capacity, host_user_id,
          profiles!host_user_id ( display_name, username ),
          jam_genres ( genres ( name ) )
        `)
        .gte('starts_at', thirtyDaysAgo.toISOString())
        .order('starts_at')
        .limit(100),
      user
        ? supabase.from('jam_rsvps').select('jam_id, status').eq('user_id', user.id)
        : Promise.resolve({ data: null }),
      user
        ? supabase.from('jam_invites').select('jam_id, status').eq('invited_user_id', user.id)
        : Promise.resolve({ data: null }),
    ]);

    const rsvpMap = new Map(
      (rsvpsResult.data ?? []).map((r: { jam_id: string; status: string }) => [r.jam_id, r.status])
    );
    const inviteMap = new Map(
      (invitesResult.data ?? []).map((i: { jam_id: string; status: string }) => [i.jam_id, i.status])
    );

    const items: JamItem[] = (jamsResult.data ?? []).map((j: any) => ({
      id: j.id,
      name: j.name,
      visibility: j.visibility,
      starts_at: j.starts_at,
      ends_at: j.ends_at,
      timezone: j.timezone,
      neighborhood: j.neighborhood,
      notes: j.notes,
      image_url: j.image_url,
      capacity: j.capacity,
      host_id: j.host_user_id,
      host_display_name: j.profiles?.display_name ?? null,
      host_username: j.profiles?.username ?? null,
      genres: (j.jam_genres ?? []).map((jg: any) => jg.genres?.name).filter(Boolean),
      rsvp_status: rsvpMap.get(j.id) ?? null,
      invite_status: inviteMap.get(j.id) ?? null,
    }));

    const now = new Date();
    const invited = items.filter(j => j.invite_status === 'pending');
    const invitedIds = new Set(invited.map(j => j.id));
    const upcoming = items.filter(j =>
      !invitedIds.has(j.id) && j.starts_at && new Date(j.starts_at) >= now
    );
    const past = items.filter(j =>
      j.starts_at && new Date(j.starts_at) < now
    ).reverse();

    const built: Section[] = [];
    if (invited.length > 0) built.push({ title: 'Invited', data: invited });
    if (upcoming.length > 0) built.push({ title: 'Upcoming', data: upcoming });
    if (past.length > 0) built.push({ title: 'Recent', data: past });

    setSections(built);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const isEmpty = !loading && sections.length === 0;

  return (
    <View className="flex-1 bg-white">
      <View className="px-4 pt-14 pb-3 border-b border-slate-100 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-slate-900">Jams</Text>
        <TouchableOpacity
          onPress={() => router.push((userId ? '/jam/new' : '/(auth)/sign-in') as any)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="w-8 h-8 rounded-full bg-amber-500 items-center justify-center"
        >
          <Ionicons name="add" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View>
          {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
        </View>
      ) : isEmpty ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-slate-900 font-semibold text-base mb-1">No upcoming jams</Text>
          <Text className="text-slate-400 text-sm text-center px-8">
            Check singjam.org to browse and RSVP to community events
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          renderItem={({ item, section }) => (
            <JamCard
              jam={item}
              myId={userId}
              isPast={section.title === 'Recent'}
              onPress={() => router.push({ pathname: '/jam/[id]', params: { id: item.id } })}
            />
          )}
          renderSectionHeader={({ section }) => (
            <View className="px-4 py-2 bg-slate-50 border-b border-slate-100">
              <Text className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                {section.title}
              </Text>
            </View>
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#d97706"
            />
          }
          stickySectionHeadersEnabled={false}
        />
      )}
    </View>
  );
}
