import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, SectionList, TouchableOpacity, RefreshControl,
  Alert, ActivityIndicator,
} from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { showOptionsSheet, anchorFrom } from '@/lib/actionSheet';
import { readCache, writeCache } from '@/lib/cache';
import BrandHeader from '@/components/BrandHeader';
import ContentContainer from '@/components/ContentContainer';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://singjam.org';

type ApiSet = {
  id: string;
  name: string;
  description: string | null;
  owner_user_id: string;
  link_sharing: 'private' | 'link' | 'public' | null;
  ownerUserId?: string | null;
  ownerName?: string | null;
  ownerUsername?: string | null;
};

type ApiPublicSet = {
  id: string;
  name: string;
  description: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  ownerUsername: string | null;
};

// Shape of `GET /api/sets` — the same payload web's SetsContent renders, so the
// owned/collaborating/public split and its dedupe live in one place.
type SetsData = {
  owned: ApiSet[];
  collaborating: ApiSet[];
  public: ApiPublicSet[];
  authenticated: boolean;
};

type CachedSets = { data: SetsData; hasRepertoire: boolean };

type SetItem = {
  id: string;
  name: string;
  description: string | null;
  link_sharing: 'private' | 'link' | 'public' | null;
  isOwner: boolean;
  canCopy: boolean;
  ownerUserId: string | null;
  ownerName: string | null;
  ownerUsername: string | null;
};

type SectionKind = 'owned' | 'collaborating' | 'public';
type Section = { title: string; kind: SectionKind; data: SetItem[] };

const SHARING_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  private: { label: 'Private',   bg: 'bg-slate-100', text: 'text-slate-500' },
  link:    { label: 'Open join', bg: 'bg-amber-100', text: 'text-amber-700' },
  public:  { label: 'Public',    bg: 'bg-sky-100',   text: 'text-sky-700' },
};

// Pure so cached payloads render through exactly the same path as live ones.
function buildSections(data: SetsData): Section[] {
  const owned: SetItem[] = data.owned.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    link_sharing: s.link_sharing ?? null,
    isOwner: true,
    canCopy: false,
    ownerUserId: null,
    ownerName: null,
    ownerUsername: null,
  }));

  const collaborating: SetItem[] = data.collaborating.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    link_sharing: s.link_sharing ?? null,
    isOwner: false,
    canCopy: true,
    ownerUserId: s.ownerUserId ?? s.owner_user_id ?? null,
    ownerName: s.ownerName ?? null,
    ownerUsername: s.ownerUsername ?? null,
  }));

  const publicSets: SetItem[] = data.public.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    link_sharing: 'public',
    isOwner: false,
    // Copying a set into your own requires an account, as on web.
    canCopy: data.authenticated,
    ownerUserId: s.ownerUserId ?? null,
    ownerName: s.ownerName ?? null,
    ownerUsername: s.ownerUsername ?? null,
  }));

  const built: Section[] = [];
  // Signed-out visitors browse public sets only — there is no "your sets" for them.
  if (data.authenticated) built.push({ title: 'Your sets', kind: 'owned', data: owned });
  if (collaborating.length > 0) built.push({ title: 'Collaborating on', kind: 'collaborating', data: collaborating });
  if (publicSets.length > 0) built.push({ title: 'Public sets', kind: 'public', data: publicSets });
  return built;
}

function SkeletonCard() {
  return (
    <View className="mx-4 mb-3 rounded-2xl border border-slate-200 bg-white p-4">
      <View className="h-4 w-1/3 bg-slate-200 rounded mb-2" />
      <View className="h-3 w-1/2 bg-slate-100 rounded" />
    </View>
  );
}

function NewSetCard({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="mx-4 mb-3 flex-row items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 py-4"
      style={{ gap: 8 }}
      accessibilityLabel="New set"
    >
      <Ionicons name="add" size={16} color="#a1a1aa" />
      <Text className="text-sm font-medium text-zinc-400">New set</Text>
    </TouchableOpacity>
  );
}

function SetCard({ set, onPress, onMenu, onCopy, onOwnerPress, busy }: {
  set: SetItem;
  onPress: () => void;
  onMenu?: (event: GestureResponderEvent) => void;
  onCopy?: () => void;
  onOwnerPress?: () => void;
  busy?: boolean;
}) {
  // Mirrors web SetCard: the visibility badge is for sets you control, so it is
  // suppressed wherever a Copy action takes its place.
  const badge = !set.canCopy && set.link_sharing ? SHARING_BADGE[set.link_sharing] : null;
  const showChevron = !set.isOwner && !set.canCopy;

  return (
    <TouchableOpacity
      onPress={onPress}
      className="mx-4 mb-3 flex-row items-center rounded-2xl border border-slate-200 bg-white active:bg-slate-50"
    >
      <View className="flex-1 min-w-0 p-4">
        <View className="flex-row items-center mb-0.5" style={{ gap: 8 }}>
          {set.isOwner ? (
            <Text className="text-xs font-semibold uppercase tracking-wide text-slate-400">Owner</Text>
          ) : set.ownerName ? (
            // Nested TouchableOpacity (not Text onPress) so the owner tap wins the
            // touch responder over the card itself, as web's nested button does.
            <View className="flex-row items-center flex-1 min-w-0">
              <Text className="text-xs text-slate-400">by </Text>
              <TouchableOpacity
                onPress={onOwnerPress}
                disabled={!onOwnerPress}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                className="flex-1 min-w-0"
              >
                <Text className="text-xs font-medium text-slate-500" numberOfLines={1}>
                  {set.ownerName}
                  {set.ownerUsername && set.ownerName !== set.ownerUsername
                    ? <Text className="font-normal text-slate-400"> @{set.ownerUsername}</Text>
                    : null}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text className="text-xs font-semibold uppercase tracking-wide text-sky-600">Collaborator</Text>
          )}
          {badge ? (
            <View className={`rounded-full px-2 py-0.5 ${badge.bg}`}>
              <Text className={`text-[10px] font-medium ${badge.text}`}>{badge.label}</Text>
            </View>
          ) : null}
        </View>
        <Text className="font-semibold text-slate-900" numberOfLines={1}>{set.name}</Text>
        {set.description ? (
          <Text className="text-sm text-slate-500 mt-0.5" numberOfLines={1}>{set.description}</Text>
        ) : null}
      </View>

      {onMenu ? (
        <View className="pr-4">
          {busy ? (
            <ActivityIndicator size="small" color="#94a3b8" />
          ) : (
            <TouchableOpacity onPress={onMenu} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityLabel="More options">
              <Ionicons name="ellipsis-horizontal" size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      ) : onCopy ? (
        <View className="pr-3">
          {busy ? (
            <ActivityIndicator size="small" color="#94a3b8" />
          ) : (
            <TouchableOpacity
              onPress={onCopy}
              className="rounded-lg border border-slate-200 px-3 py-1.5"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text className="text-xs font-medium text-slate-600">Copy</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : showChevron ? (
        <View className="pr-4">
          <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export default function SetsScreen() {
  const [sections, setSections] = useState<Section[]>([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [hasRepertoire, setHasRepertoire] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const router = useRouter();

  function apply(data: SetsData, repertoire: boolean) {
    setSections(buildSections(data));
    setAuthenticated(data.authenticated);
    setHasRepertoire(repertoire);
  }

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user.id ?? null;

    const res = await fetch(`${WEB_URL}/api/sets`, {
      headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    }).catch(() => null);

    if (!res?.ok) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const data = (await res.json()) as SetsData;

    // Same nudge condition as web: signed in with an empty repertoire.
    let repertoire = true;
    if (data.authenticated && uid) {
      const { count } = await supabase
        .from('user_songs')
        .select('song_id', { count: 'exact', head: true })
        .eq('user_id', uid);
      repertoire = (count ?? 0) > 0;
    }

    writeCache<CachedSets>('/sets', uid, { data, hasRepertoire: repertoire });
    apply(data, repertoire);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    // Paint cached sets immediately on launch; the focus-effect load() below
    // still runs and silently replaces them (web's sessionStorage hydrate).
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const cached = await readCache<CachedSets>('/sets', session?.user.id ?? null);
      if (cached) {
        apply(cached.data, cached.hasRepertoire);
        setLoading(false);
      }
    })();
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function apiFetch(path: string, method: 'POST' | 'DELETE') {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    return fetch(`${WEB_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  }

  async function copySet(set: SetItem) {
    setBusyId(set.id);
    try {
      const res = await apiFetch(`/api/sets/${set.id}/copy`, 'POST');
      if (res?.ok) {
        const { id } = await res.json();
        router.push({ pathname: '/set/[id]' as any, params: { id } });
      } else {
        Alert.alert('Copy failed', 'Something went wrong copying this set.');
      }
    } finally {
      setBusyId(null);
    }
  }

  function confirmDelete(set: SetItem) {
    Alert.alert('Delete this set?', "This can't be undone.", [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Yes, delete',
        style: 'destructive',
        onPress: async () => {
          setBusyId(set.id);
          try {
            const res = await apiFetch(`/api/sets/${set.id}`, 'DELETE');
            if (res?.ok) load();
            else Alert.alert('Delete failed', 'Something went wrong deleting this set.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  function openSetMenu(set: SetItem, event: GestureResponderEvent) {
    showOptionsSheet({
      title: set.name,
      anchor: anchorFrom(event),
      options: [
        { label: 'Copy set', onPress: () => copySet(set) },
        { label: 'Delete set', destructive: true, onPress: () => confirmDelete(set) },
      ],
    });
  }

  return (
    <View className="flex-1 bg-slate-50">
      <BrandHeader />
      <ContentContainer>
      <View className="px-4 pt-4 pb-3 bg-white border-b border-slate-100">
        <Text className="text-2xl font-bold text-slate-900">Sets</Text>
        <Text className="text-sm text-slate-500 mt-0.5">Build song lists for your jams and gigs.</Text>
      </View>

      {loading ? (
        <View className="pt-4">
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
              onMenu={item.isOwner ? (e) => openSetMenu(item, e) : undefined}
              onCopy={item.canCopy ? () => copySet(item) : undefined}
              onOwnerPress={
                item.ownerUserId
                  ? () => router.push({ pathname: '/profile/[id]' as any, params: { id: item.ownerUserId } })
                  : undefined
              }
              busy={busyId === item.id}
            />
          )}
          renderSectionHeader={({ section }) => (
            <View>
              <View className="px-4 pt-5 pb-2">
                <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  {section.title}
                </Text>
              </View>
              {/* Sets are ordered newest-first, so the create affordance sits at
                  the top of your own sets — where the new one will appear. It is
                  the only entry point, and doubles as the empty state. */}
              {section.kind === 'owned' ? (
                <NewSetCard onPress={() => router.push('/set/new' as any)} />
              ) : null}
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
          ListHeaderComponent={
            authenticated && !hasRepertoire ? (
              <View className="mx-4 mt-4 rounded-2xl border border-slate-200 bg-white p-6 items-center">
                <Text className="text-base font-semibold text-slate-900">Your repertoire is empty</Text>
                <Text className="mt-1 text-sm text-slate-500 text-center">
                  Add songs you know to build sets for your jams and performances.
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/songs' as any)}
                  className="mt-4 rounded-xl bg-amber-500 px-5 py-2.5"
                >
                  <Text className="text-sm font-semibold text-white">Browse songs →</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          ListFooterComponent={
            !authenticated ? (
              <View className="mx-4 mt-4 rounded-2xl border border-slate-200 bg-white p-8 items-center">
                <Text className="text-base font-semibold text-slate-900 text-center">
                  Build sets for your jams and gigs
                </Text>
                <Text className="mt-2 text-sm text-slate-500 text-center">
                  Sign up to build your own sets, track your repertoire, and find jam partners who know the same songs.
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/(auth)/sign-in?mode=signup' as any)}
                  className="mt-4"
                >
                  <Text className="text-sm font-medium text-amber-600">Sign up →</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          stickySectionHeadersEnabled={false}
        />
      )}
      </ContentContainer>
    </View>
  );
}
