import { useState, useCallback } from 'react';
import {
  View, Text, SectionList, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import SignInPrompt from '@/components/SignInPrompt';
import BrandHeader from '@/components/BrandHeader';

type SetItem = {
  id: string;
  name: string;
  description: string | null;
  owner_user_id: string;
  link_sharing: 'private' | 'link' | 'public' | null;
  isOwner: boolean;
  ownerName: string | null;
  ownerUsername: string | null;
};

type Section = { title: string; data: SetItem[] };

const SHARING_BADGE: Record<string, { label: string; className: string }> = {
  private: { label: 'Private', className: 'bg-slate-100 text-slate-500' },
  link:    { label: 'Open join', className: 'bg-amber-100 text-amber-700' },
  public:  { label: 'Public', className: 'bg-sky-100 text-sky-700' },
};

function SkeletonCard() {
  return (
    <View className="mx-4 mb-2 rounded-2xl border border-slate-100 bg-white p-4">
      <View className="h-4 w-1/3 bg-slate-200 rounded mb-2" />
      <View className="h-3 w-1/2 bg-slate-100 rounded" />
    </View>
  );
}

function SetCard({ set, onPress }: { set: SetItem; onPress: () => void }) {
  const badge = set.link_sharing ? SHARING_BADGE[set.link_sharing] : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      className="mx-4 mb-2 rounded-2xl border border-slate-100 bg-white p-4 active:bg-slate-50"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 mr-2">
          {set.isOwner ? (
            <Text className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Owner</Text>
          ) : set.ownerName ? (
            <Text className="text-xs text-slate-400 mb-0.5">
              by <Text className="font-medium text-slate-500">{set.ownerName}</Text>
              {set.ownerUsername && set.ownerName !== set.ownerUsername
                ? <Text className="font-normal"> @{set.ownerUsername}</Text>
                : null}
            </Text>
          ) : (
            <Text className="text-xs font-semibold uppercase tracking-wide text-sky-600 mb-0.5">Collaborator</Text>
          )}
          <Text className="font-semibold text-slate-900" numberOfLines={1}>{set.name}</Text>
          {set.description ? (
            <Text className="text-sm text-slate-400 mt-0.5" numberOfLines={1}>{set.description}</Text>
          ) : null}
        </View>
        {badge && set.isOwner ? (
          <View className={`rounded-full px-2 py-0.5 ${badge.className.split(' ')[0]}`}>
            <Text className={`text-xs font-medium ${badge.className.split(' ')[1]}`}>{badge.label}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function SetsScreen() {
  const [sections, setSections] = useState<Section[]>([]);
  const [myId, setMyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); setRefreshing(false); return; }
    setMyId(user.id);

    const [ownedRes, collabRes, publicRes] = await Promise.all([
      supabase
        .from('sets')
        .select('id, name, description, owner_user_id, link_sharing')
        .eq('owner_user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('set_collaborators')
        .select('sets(id, name, description, owner_user_id, link_sharing, profiles!owner_user_id(display_name, last_name, username))')
        .eq('user_id', user.id)
        .eq('status', 'accepted'),
      supabase
        .from('sets')
        .select('id, name, description, owner_user_id, profiles!owner_user_id(display_name, last_name, username)')
        .eq('link_sharing', 'public')
        .neq('owner_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const owned: SetItem[] = (ownedRes.data ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      owner_user_id: s.owner_user_id,
      link_sharing: s.link_sharing ?? null,
      isOwner: true,
      ownerName: null,
      ownerUsername: null,
    }));

    const collabSetIds = new Set(owned.map((s) => s.id));

    const collaborating: SetItem[] = ((collabRes.data ?? []) as any[])
      .map((r) => r.sets)
      .filter(Boolean)
      .filter((s: any) => s.owner_user_id !== user.id && !collabSetIds.has(s.id))
      .map((s: any) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        owner_user_id: s.owner_user_id,
        link_sharing: s.link_sharing ?? null,
        isOwner: false,
        ownerName: [s.profiles?.display_name, s.profiles?.last_name].filter(Boolean).join(' ') || s.profiles?.username || null,
        ownerUsername: s.profiles?.username ?? null,
      }));

    const allMyIds = new Set([...owned.map((s) => s.id), ...collaborating.map((s) => s.id)]);

    const publicSets: SetItem[] = ((publicRes.data ?? []) as any[])
      .filter((s) => !allMyIds.has(s.id))
      .map((s: any) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        owner_user_id: s.owner_user_id,
        link_sharing: 'public' as const,
        isOwner: false,
        ownerName: [s.profiles?.display_name, s.profiles?.last_name].filter(Boolean).join(' ') || s.profiles?.username || null,
        ownerUsername: s.profiles?.username ?? null,
      }));

    const built: Section[] = [];
    built.push({ title: 'Your Sets', data: owned });
    if (collaborating.length > 0) built.push({ title: 'Collaborating On', data: collaborating });
    if (publicSets.length > 0) built.push({ title: 'Public Sets', data: publicSets });

    setSections(built);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const { session, initialised } = useAuth();
  if (initialised && !session) return <SignInPrompt message="Sign in to see your sets" />;

  return (
    <View className="flex-1 bg-slate-50">
      <BrandHeader />
      <View className="px-4 pt-4 pb-3 bg-white border-b border-slate-100 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-slate-900">Sets</Text>
          <Text className="text-sm text-slate-500 mt-0.5">Build song lists for your jams and gigs.</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/set/new' as any)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="w-8 h-8 rounded-full bg-amber-500 items-center justify-center"
        >
          <Ionicons name="add" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="pt-3">
          {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SetCard
              set={item}
              onPress={() => router.push({ pathname: '/set/[id]' as any, params: { id: item.id } })}
            />
          )}
          renderSectionHeader={({ section }) => (
            <View className="px-4 pt-4 pb-1">
              <Text className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                {section.title}
              </Text>
            </View>
          )}
          SectionSeparatorComponent={() => null}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#d97706"
            />
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center pt-24 px-8">
              <Text className="text-slate-900 font-semibold text-base mb-1">No sets yet</Text>
              <Text className="text-slate-400 text-sm text-center">
                Create your first set to build a song list for your jams and gigs.
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/set/new' as any)}
                className="mt-4 bg-amber-500 rounded-xl px-5 py-2.5"
              >
                <Text className="text-white font-semibold">Create a set</Text>
              </TouchableOpacity>
            </View>
          }
          ListHeaderComponent={
            sections.length > 0 ? (
              <TouchableOpacity
                onPress={() => router.push('/set/new' as any)}
                className="mx-4 mt-3 mb-1 rounded-2xl border-2 border-dashed border-slate-200 py-4 items-center flex-row justify-center gap-2"
              >
                <Ionicons name="add" size={16} color="#94a3b8" />
                <Text className="text-slate-400 font-medium text-sm">New set</Text>
              </TouchableOpacity>
            ) : null
          }
          stickySectionHeadersEnabled={false}
        />
      )}
    </View>
  );
}
