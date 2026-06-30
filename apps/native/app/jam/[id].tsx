import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Image, Modal, TextInput, FlatList,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatJamTime } from '@singjam/core';
import { supabase } from '@/lib/supabase';

type JamDetail = {
  id: string;
  name: string | null;
  visibility: string;
  starts_at: string | null;
  ends_at: string | null;
  timezone: string | null;
  neighborhood: string | null;
  full_address: string | null;
  notes: string | null;
  image_url: string | null;
  tickets_url: string | null;
  capacity: number | null;
  host_id: string | null;
  host_display_name: string | null;
  host_username: string | null;
  host_avatar: string | null;
  genres: string[];
};

type Attendee = {
  user_id: string;
  status: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type JamSet = {
  id: string;
  name: string;
};

type UserSearchResult = {
  id: string;
  username: string | null;
  display_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

function InviteUsersModal({
  visible,
  jamId,
  jamName,
  attendeeIds,
  onClose,
}: {
  visible: boolean;
  jamId: string;
  jamName: string;
  attendeeIds: Set<string>;
  onClose: () => void;
}) {
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setResults([]);
    setSent(new Set());
    supabase.auth.getUser().then(({ data: { user } }) => setMyUserId(user?.id ?? null));
  }, [visible]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    searchTimer.current = setTimeout(() => runSearch(q), 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [query]);

  async function runSearch(q: string) {
    if (!myUserId) return;
    setSearching(true);
    const { data } = await supabase.rpc('search_users', {
      search_query: q.startsWith('@') ? q.slice(1) : q,
      exclude_user_id: myUserId,
    });
    setResults(data ?? []);
    setSearching(false);
  }

  async function handleInvite(userId: string) {
    setPending(userId);
    const { error } = await supabase
      .from('jam_invites')
      .insert({ jam_id: jamId, invited_user_id: userId, status: 'pending' });

    if (error && !error.message.includes('duplicate')) {
      Alert.alert('Error', error.message);
    } else {
      setSent(prev => new Set([...prev, userId]));
      if (myUserId) {
        await supabase.from('notifications').insert({
          user_id: userId,
          type: 'jam_invite',
          title: `You've been invited to ${jamName}`,
          link: `/jam/${jamId}`,
        });
      }
    }
    setPending(null);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        className="flex-1 bg-white"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="flex-row items-center px-4 pt-4 pb-3 border-b border-slate-100">
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text className="text-amber-600 font-medium">Done</Text>
          </TouchableOpacity>
          <Text className="flex-1 text-center font-semibold text-slate-900">Invite people</Text>
          <View style={{ width: 50 }} />
        </View>

        <View className="px-4 py-3 border-b border-slate-100">
          <View className="flex-row items-center bg-slate-100 rounded-xl px-3 py-2">
            <Text className="text-slate-400 mr-2">🔍</Text>
            <TextInput
              className="flex-1 text-slate-900"
              placeholder="Search by name or @username…"
              placeholderTextColor="#94a3b8"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoFocus
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Text className="text-slate-400 ml-2">✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {searching ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#d97706" />
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={item => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 40 }}
            ListEmptyComponent={
              query.trim().length >= 2 ? (
                <View className="items-center pt-12">
                  <Text className="text-slate-400 text-sm">No results for "{query}"</Text>
                </View>
              ) : (
                <View className="items-center pt-12">
                  <Text className="text-slate-400 text-sm">Search for a jammer to invite</Text>
                </View>
              )
            }
            renderItem={({ item }) => {
              const isAttending = attendeeIds.has(item.id);
              const isSent = sent.has(item.id);
              const isPending = pending === item.id;
              const name = item.display_name ?? item.username ?? 'Unknown';
              const initial = name[0]?.toUpperCase() ?? '?';

              return (
                <View className="flex-row items-center px-4 py-3 border-b border-slate-100">
                  {item.avatar_url ? (
                    <Image
                      source={{ uri: item.avatar_url }}
                      className="w-9 h-9 rounded-full mr-3"
                    />
                  ) : (
                    <View className="w-9 h-9 rounded-full bg-slate-200 items-center justify-center mr-3">
                      <Text className="text-slate-600 font-semibold text-sm">{initial}</Text>
                    </View>
                  )}
                  <View className="flex-1 mr-3">
                    <Text className="text-slate-900 font-medium" numberOfLines={1}>{name}</Text>
                    {item.username ? (
                      <Text className="text-slate-400 text-sm mt-0.5">@{item.username}</Text>
                    ) : null}
                  </View>
                  {isAttending ? (
                    <Text className="text-slate-400 text-xs">Attending</Text>
                  ) : isPending ? (
                    <ActivityIndicator size="small" color="#d97706" />
                  ) : isSent ? (
                    <Text className="text-green-600 text-sm font-semibold">Sent ✓</Text>
                  ) : (
                    <TouchableOpacity
                      onPress={() => handleInvite(item.id)}
                      className="bg-amber-500 rounded-full px-4 py-1.5"
                    >
                      <Text className="text-white text-sm font-semibold">Invite</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function AttendeeAvatar({ attendee, isMe }: { attendee: Attendee; isMe: boolean }) {
  const name = attendee.display_name ?? attendee.username ?? '?';
  const initial = name[0]?.toUpperCase() ?? '?';
  return (
    <View className="items-center mr-3 mb-3" style={{ width: 52 }}>
      {attendee.avatar_url ? (
        <Image source={{ uri: attendee.avatar_url }} className="w-10 h-10 rounded-full mb-1" />
      ) : (
        <View className={`w-10 h-10 rounded-full items-center justify-center mb-1 ${isMe ? 'bg-amber-500' : 'bg-slate-200'}`}>
          <Text className={`font-semibold text-sm ${isMe ? 'text-white' : 'text-slate-600'}`}>{initial}</Text>
        </View>
      )}
      <Text className="text-slate-500 text-xs text-center" numberOfLines={1}>
        {attendee.username ? `@${attendee.username}` : name}
      </Text>
    </View>
  );
}

function InfoRow({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <View className="flex-row items-start mb-3">
      <Text className="text-base mr-3 mt-0.5">{icon}</Text>
      <View className="flex-1">{children}</View>
    </View>
  );
}

export default function JamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [jam, setJam] = useState<JamDetail | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [myRsvpStatus, setMyRsvpStatus] = useState<string | null>(null);
  const [myInviteStatus, setMyInviteStatus] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [jamSets, setJamSets] = useState<JamSet[]>([]);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    load();
  }, [id]);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyUserId(user.id);

    const [jamResult, rsvpsResult, inviteResult, setsResult] = await Promise.all([
      supabase
        .from('jams')
        .select(`
          id, name, visibility, starts_at, ends_at, timezone,
          neighborhood, full_address, notes, image_url, tickets_url, capacity, host_user_id,
          profiles!host_user_id ( display_name, username, avatar_url ),
          jam_genres ( genres ( name ) )
        `)
        .eq('id', id)
        .single(),
      supabase
        .from('jam_rsvps')
        .select('status, user_id, profiles!user_id ( display_name, username, avatar_url )')
        .eq('jam_id', id)
        .in('status', ['attending', 'waitlist'])
        .limit(30),
      supabase
        .from('jam_invites')
        .select('status')
        .eq('jam_id', id)
        .eq('invited_user_id', user.id)
        .maybeSingle(),
      supabase
        .from('sets')
        .select('id, name')
        .eq('jam_id', id)
        .limit(10),
    ]);

    if (!jamResult.data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const j = jamResult.data as any;
    setJam({
      id: j.id,
      name: j.name,
      visibility: j.visibility,
      starts_at: j.starts_at,
      ends_at: j.ends_at,
      timezone: j.timezone,
      neighborhood: j.neighborhood,
      full_address: j.full_address,
      notes: j.notes,
      image_url: j.image_url,
      tickets_url: j.tickets_url,
      capacity: j.capacity,
      host_id: j.host_user_id,
      host_display_name: j.profiles?.display_name ?? null,
      host_username: j.profiles?.username ?? null,
      host_avatar: j.profiles?.avatar_url ?? null,
      genres: (j.jam_genres ?? []).map((jg: any) => jg.genres?.name).filter(Boolean),
    });

    const rawRsvps: Attendee[] = (rsvpsResult.data ?? []).map((r: any) => ({
      user_id: r.user_id,
      status: r.status,
      display_name: r.profiles?.display_name ?? null,
      username: r.profiles?.username ?? null,
      avatar_url: r.profiles?.avatar_url ?? null,
    }));

    setAttendees(rawRsvps.filter(r => r.status === 'attending'));
    const myRsvp = rawRsvps.find(r => r.user_id === user.id);
    setMyRsvpStatus(myRsvp?.status ?? null);
    setMyInviteStatus(inviteResult.data?.status ?? null);
    setJamSets((setsResult.data ?? []).map((s: any) => ({ id: s.id, name: s.name })));
    setLoading(false);
  }

  async function handleRsvp() {
    if (!myUserId || !jam) return;
    if (jam.visibility === 'official') {
      Alert.alert('External ticketing', 'Official SingJam events use external ticketing.');
      return;
    }
    setRsvpLoading(true);

    const { count: attendingCount } = await supabase
      .from('jam_rsvps')
      .select('id', { count: 'exact', head: true })
      .eq('jam_id', jam.id)
      .eq('status', 'attending');

    const isFull = jam.capacity !== null && (attendingCount ?? 0) >= jam.capacity;
    const newStatus: 'attending' | 'waitlist' = isFull ? 'waitlist' : 'attending';

    let waitlistPosition: number | null = null;
    if (isFull) {
      const { count: waitlistCount } = await supabase
        .from('jam_rsvps')
        .select('id', { count: 'exact', head: true })
        .eq('jam_id', jam.id)
        .eq('status', 'waitlist');
      waitlistPosition = (waitlistCount ?? 0) + 1;
    }

    const { data: existing } = await supabase
      .from('jam_rsvps')
      .select('id')
      .eq('jam_id', jam.id)
      .eq('user_id', myUserId)
      .maybeSingle();

    const rsvpMutation = existing
      ? supabase.from('jam_rsvps').update({ status: newStatus, waitlist_position: waitlistPosition }).eq('id', existing.id)
      : supabase.from('jam_rsvps').insert({ jam_id: jam.id, user_id: myUserId, status: newStatus, waitlist_position: waitlistPosition });

    const { error } = await rsvpMutation;
    if (error) {
      Alert.alert('Error', error.message);
      setRsvpLoading(false);
      return;
    }

    if (newStatus === 'attending') {
      const { data: linkedSet } = await supabase
        .from('sets')
        .select('id, owner_user_id')
        .eq('jam_id', jam.id)
        .maybeSingle();
      if (linkedSet && linkedSet.owner_user_id !== myUserId) {
        const { data: existingCollab } = await supabase
          .from('set_collaborators')
          .select('id')
          .eq('set_id', linkedSet.id)
          .eq('user_id', myUserId)
          .maybeSingle();
        if (!existingCollab) {
          await supabase.from('set_collaborators').insert({
            set_id: linkedSet.id,
            user_id: myUserId,
            invited_by: linkedSet.owner_user_id,
            status: 'accepted',
          });
        }
      }
    }

    if (jam.host_id && jam.host_id !== myUserId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, username')
        .eq('id', myUserId)
        .maybeSingle();
      const name = (profile as any)?.display_name ?? (profile as any)?.username ?? 'Someone';
      await supabase.from('notifications').insert({
        user_id: jam.host_id,
        type: 'jam_rsvp',
        title: `${name} is ${newStatus === 'waitlist' ? 'on the waitlist for' : 'going to'} ${jam.name ?? 'your jam'}`,
        link: `/jam/${jam.id}`,
      });
    }

    setMyRsvpStatus(newStatus);
    if (newStatus === 'attending') {
      setAttendees(prev => [
        ...prev.filter(a => a.user_id !== myUserId),
        { user_id: myUserId, status: 'attending', display_name: null, username: null, avatar_url: null },
      ]);
    }
    setRsvpLoading(false);
  }

  async function handleCancelRsvp() {
    if (!myUserId || !jam) return;
    Alert.alert('Cancel RSVP', 'Are you sure you want to cancel your RSVP?', [
      {
        text: 'Cancel RSVP',
        style: 'destructive',
        onPress: async () => {
          setRsvpLoading(true);

          const { data: rsvp } = await supabase
            .from('jam_rsvps')
            .select('id, status')
            .eq('jam_id', jam.id)
            .eq('user_id', myUserId)
            .maybeSingle();

          if (!rsvp) { setRsvpLoading(false); return; }

          const { error } = await supabase
            .from('jam_rsvps')
            .update({ status: 'cancelled', waitlist_position: null })
            .eq('id', rsvp.id);

          if (error) {
            Alert.alert('Error', error.message);
            setRsvpLoading(false);
            return;
          }

          setMyRsvpStatus('cancelled');
          setAttendees(prev => prev.filter(a => a.user_id !== myUserId));

          if (rsvp.status === 'attending') {
            const { data: next } = await supabase
              .from('jam_rsvps')
              .select('id, user_id')
              .eq('jam_id', jam.id)
              .eq('status', 'waitlist')
              .order('waitlist_position', { ascending: true })
              .limit(1)
              .maybeSingle();

            if (next) {
              await supabase
                .from('jam_rsvps')
                .update({ status: 'attending', waitlist_position: null })
                .eq('id', next.id);
              await supabase.from('notifications').insert({
                user_id: next.user_id,
                type: 'jam_rsvp',
                title: `A spot opened up at ${jam.name ?? 'the jam'} — you're in!`,
                link: `/jam/${jam.id}`,
              });
            }
          }

          setRsvpLoading(false);
        },
      },
      { text: 'Keep RSVP', style: 'cancel' },
    ]);
  }

  async function handleInviteResponse(response: 'accepted' | 'declined') {
    if (!myUserId || !jam) return;
    setRsvpLoading(true);

    const { data: invite } = await supabase
      .from('jam_invites')
      .select('id, invited_by')
      .eq('jam_id', jam.id)
      .eq('invited_user_id', myUserId)
      .maybeSingle();

    if (!invite) { setRsvpLoading(false); return; }

    await supabase.from('jam_invites').update({ status: response }).eq('id', invite.id);

    if (response === 'accepted') {
      const { count: attendingCount } = await supabase
        .from('jam_rsvps')
        .select('id', { count: 'exact', head: true })
        .eq('jam_id', jam.id)
        .eq('status', 'attending');

      const isFull = jam.capacity !== null && (attendingCount ?? 0) >= jam.capacity;
      let waitlistPosition: number | null = null;
      if (isFull) {
        const { count: waitlistCount } = await supabase
          .from('jam_rsvps')
          .select('id', { count: 'exact', head: true })
          .eq('jam_id', jam.id)
          .eq('status', 'waitlist');
        waitlistPosition = (waitlistCount ?? 0) + 1;
      }
      const rsvpStatus: 'attending' | 'waitlist' = isFull ? 'waitlist' : 'attending';

      const { data: existingRsvp } = await supabase
        .from('jam_rsvps')
        .select('id')
        .eq('jam_id', jam.id)
        .eq('user_id', myUserId)
        .maybeSingle();

      if (existingRsvp) {
        await supabase.from('jam_rsvps').update({ status: rsvpStatus, waitlist_position: waitlistPosition }).eq('id', existingRsvp.id);
      } else {
        await supabase.from('jam_rsvps').insert({ jam_id: jam.id, user_id: myUserId, status: rsvpStatus, waitlist_position: waitlistPosition });
      }

      if (rsvpStatus === 'attending') {
        const { data: linkedSet } = await supabase
          .from('sets')
          .select('id, owner_user_id')
          .eq('jam_id', jam.id)
          .maybeSingle();
        if (linkedSet && linkedSet.owner_user_id !== myUserId) {
          const { data: existingCollab } = await supabase
            .from('set_collaborators')
            .select('id')
            .eq('set_id', linkedSet.id)
            .eq('user_id', myUserId)
            .maybeSingle();
          if (!existingCollab) {
            await supabase.from('set_collaborators').insert({
              set_id: linkedSet.id,
              user_id: myUserId,
              invited_by: linkedSet.owner_user_id,
              status: 'accepted',
            });
          }
        }
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, username')
        .eq('id', myUserId)
        .maybeSingle();
      const accepterName = (profile as any)?.display_name ?? (profile as any)?.username ?? 'Someone';

      await Promise.all([
        invite.invited_by && invite.invited_by !== jam.host_id
          ? supabase.from('notifications').insert({
              user_id: invite.invited_by,
              type: 'invite_accepted',
              title: `${accepterName} accepted your invite to ${jam.name ?? 'your jam'}`,
              link: `/jam/${jam.id}`,
            })
          : Promise.resolve(),
        jam.host_id && jam.host_id !== myUserId
          ? supabase.from('notifications').insert({
              user_id: jam.host_id,
              type: 'jam_rsvp',
              title: `${accepterName} is going to ${jam.name ?? 'your jam'}`,
              link: `/jam/${jam.id}`,
            })
          : Promise.resolve(),
      ]);

      setMyRsvpStatus(rsvpStatus);
    }

    setMyInviteStatus(response);
    setRsvpLoading(false);
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: '' }} />
        <View className="flex-1 bg-white items-center justify-center">
          <ActivityIndicator color="#d97706" />
        </View>
      </>
    );
  }

  if (notFound || !jam) {
    return (
      <>
        <Stack.Screen options={{ title: 'Jam' }} />
        <View className="flex-1 bg-white items-center justify-center">
          <Text className="text-slate-400">Jam not found</Text>
        </View>
      </>
    );
  }

  async function handleDuplicate() {
    if (!jam || !myUserId) return;
    const { data, error: insertError } = await supabase.from('jams').insert({
      host_user_id: myUserId,
      name: `${jam.name ?? 'Jam'} (copy)`,
      starts_at: jam.starts_at,
      ends_at: jam.ends_at,
      neighborhood: jam.neighborhood,
      full_address: jam.full_address,
      notes: jam.notes,
      visibility: jam.visibility === 'official' ? 'community' : jam.visibility,
      capacity: jam.capacity,
      timezone: jam.timezone,
      created_at: new Date().toISOString(),
    }).select('id').single();

    if (insertError || !data?.id) { Alert.alert('Error', insertError?.message ?? 'Could not duplicate jam.'); return; }

    if (jam.genres.length > 0) {
      const { data: genreRows } = await supabase
        .from('genres')
        .select('id, name')
        .in('name', jam.genres);
      if (genreRows && genreRows.length > 0) {
        await supabase.from('jam_genres').insert(genreRows.map((g: any) => ({ jam_id: data.id, genre_id: g.id })));
      }
    }

    router.push({ pathname: '/jam/[id]' as any, params: { id: data.id } });
  }

  const isHosting = jam.host_id === myUserId;
  const isFull = jam.capacity !== null && attendees.length >= jam.capacity;
  const timeStr = formatJamTime(jam.starts_at, jam.timezone);
  const isPast = jam.starts_at ? new Date(jam.starts_at) < new Date() : false;
  const hasFullAccess = isHosting || myRsvpStatus === 'attending' || myInviteStatus === 'accepted' || jam.visibility === 'official' || jam.visibility === 'private';

  const attendeeIds = new Set(attendees.map(a => a.user_id));

  return (
    <>
      <InviteUsersModal
        visible={inviteModalVisible}
        jamId={jam.id}
        jamName={jam.name ?? 'this jam'}
        attendeeIds={attendeeIds}
        onClose={() => setInviteModalVisible(false)}
      />
      <Stack.Screen
        options={{
          title: jam.name ?? 'Jam',
          headerTintColor: '#d97706',
          headerRight: isHosting ? () => (
            <View className="flex-row gap-4">
              <TouchableOpacity onPress={handleDuplicate} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="copy-outline" size={20} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/jam/edit' as any, params: { id: jam.id } })}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="pencil-outline" size={20} color="#d97706" />
              </TouchableOpacity>
            </View>
          ) : undefined,
        }}
      />
      <ScrollView className="flex-1 bg-white">

        {/* Header image or date block */}
        {jam.image_url ? (
          <Image
            source={{ uri: jam.image_url }}
            className="w-full"
            style={{ height: 200 }}
            resizeMode="cover"
          />
        ) : jam.starts_at ? (
          <View className="bg-amber-50 items-center justify-center py-10">
            <Text className="text-amber-400 text-sm font-medium uppercase tracking-widest mb-1">
              {new Date(jam.starts_at).toLocaleString('en', { weekday: 'long' })}
            </Text>
            <Text className="text-amber-700 text-5xl font-bold">
              {new Date(jam.starts_at).getDate()}
            </Text>
            <Text className="text-amber-500 text-lg font-medium">
              {new Date(jam.starts_at).toLocaleString('en', { month: 'long', year: 'numeric' })}
            </Text>
          </View>
        ) : null}

        {/* Title + badges */}
        <View className="px-4 pt-5 pb-2">
          <Text className="text-2xl font-bold text-slate-900 mb-1">{jam.name ?? 'Jam Session'}</Text>
          <View className="flex-row flex-wrap gap-2">
            {jam.visibility === 'official' ? (
              <View className="bg-amber-100 rounded-full px-3 py-0.5">
                <Text className="text-amber-700 text-xs font-semibold">Official SingJam Event</Text>
              </View>
            ) : jam.visibility === 'community' ? (
              <View className="bg-slate-100 rounded-full px-3 py-0.5">
                <Text className="text-slate-500 text-xs font-medium">Community</Text>
              </View>
            ) : null}
            {isPast ? (
              <View className="bg-slate-100 rounded-full px-3 py-0.5">
                <Text className="text-slate-500 text-xs font-medium">Past event</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Info rows */}
        <View className="px-4 py-4">
          {timeStr ? (
            <InfoRow icon="📅">
              <Text className="text-slate-700">{timeStr}</Text>
            </InfoRow>
          ) : null}

          {jam.neighborhood || jam.full_address ? (
            <InfoRow icon="📍">
              {jam.neighborhood ? (
                <Text className="text-slate-700 font-medium">{jam.neighborhood}</Text>
              ) : null}
              {jam.full_address && hasFullAccess ? (
                <Text className="text-slate-400 text-sm mt-0.5">{jam.full_address}</Text>
              ) : jam.full_address && !hasFullAccess ? (
                <Text className="text-slate-400 text-sm mt-0.5 italic">Full address shown after RSVP</Text>
              ) : null}
            </InfoRow>
          ) : null}

          {!isHosting && (jam.host_display_name || jam.host_username) ? (
            <InfoRow icon="🎤">
              <Text className="text-slate-700">
                Hosted by{' '}
                <Text className="font-medium">{jam.host_display_name ?? `@${jam.host_username}`}</Text>
                {jam.host_username ? (
                  <Text className="text-slate-400"> @{jam.host_username}</Text>
                ) : null}
              </Text>
            </InfoRow>
          ) : null}

          {jam.genres.length > 0 ? (
            <InfoRow icon="🎵">
              <View className="flex-row flex-wrap gap-1">
                {jam.genres.map(g => (
                  <View key={g} className="bg-slate-100 rounded-full px-3 py-0.5">
                    <Text className="text-slate-500 text-sm">{g}</Text>
                  </View>
                ))}
              </View>
            </InfoRow>
          ) : null}

          {jam.capacity !== null ? (
            <InfoRow icon="👥">
              <Text className="text-slate-700">
                {attendees.length}{jam.capacity ? ` of ${jam.capacity}` : ''} attending
                {isFull ? ' · Full — join waitlist' : ''}
              </Text>
            </InfoRow>
          ) : attendees.length > 0 ? (
            <InfoRow icon="👥">
              <Text className="text-slate-700">{attendees.length} attending</Text>
            </InfoRow>
          ) : null}
        </View>

        {/* RSVP action */}
        {!isPast ? (
          <View className="px-4 mb-6">
            {isHosting ? (
              <View className="gap-2">
                <View className="bg-amber-50 rounded-xl py-3 items-center border border-amber-200">
                  <Text className="text-amber-700 font-semibold">You're hosting this jam</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setInviteModalVisible(true)}
                  className="border border-amber-300 rounded-xl py-3 flex-row items-center justify-center gap-2"
                >
                  <Ionicons name="person-add-outline" size={16} color="#d97706" />
                  <Text className="text-amber-700 font-medium">Invite people</Text>
                </TouchableOpacity>
              </View>
            ) : myInviteStatus === 'pending' ? (
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => handleInviteResponse('accepted')}
                  disabled={rsvpLoading}
                  className="flex-1 bg-amber-500 rounded-xl py-3 items-center"
                >
                  {rsvpLoading ? <ActivityIndicator color="#fff" /> : (
                    <Text className="text-white font-semibold">Accept</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleInviteResponse('declined')}
                  disabled={rsvpLoading}
                  className="flex-1 border border-slate-200 rounded-xl py-3 items-center"
                >
                  <Text className="text-slate-600 font-semibold">Decline</Text>
                </TouchableOpacity>
              </View>
            ) : myRsvpStatus === 'attending' || myInviteStatus === 'accepted' ? (
              <TouchableOpacity
                onPress={handleCancelRsvp}
                disabled={rsvpLoading}
                className="border border-slate-200 rounded-xl py-3 items-center"
              >
                {rsvpLoading ? <ActivityIndicator color="#94a3b8" /> : (
                  <Text className="text-slate-600 font-semibold">✓ Going · Cancel RSVP</Text>
                )}
              </TouchableOpacity>
            ) : myRsvpStatus === 'waitlist' ? (
              <View className="bg-blue-50 rounded-xl py-3 items-center border border-blue-200">
                <Text className="text-blue-700 font-semibold">You're on the waitlist</Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleRsvp}
                disabled={rsvpLoading}
                className="bg-amber-500 rounded-xl py-3 items-center"
              >
                {rsvpLoading ? <ActivityIndicator color="#fff" /> : (
                  <Text className="text-white font-semibold">{isFull ? 'Join Waitlist' : 'RSVP'}</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {/* Notes */}
        {jam.notes ? (
          <View className="px-4 mb-6">
            <Text className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-2">About</Text>
            <Text className="text-slate-700 leading-relaxed">{jam.notes}</Text>
          </View>
        ) : null}

        {/* Attendees */}
        {attendees.length > 0 ? (
          <View className="px-4 mb-6">
            <Text className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-3">
              Attending ({attendees.length})
            </Text>
            <View className="flex-row flex-wrap">
              {attendees.slice(0, 20).map(a => (
                <AttendeeAvatar key={a.user_id} attendee={a} isMe={a.user_id === myUserId} />
              ))}
              {attendees.length > 20 ? (
                <View className="items-center mr-3 mb-3" style={{ width: 52 }}>
                  <View className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center mb-1">
                    <Text className="text-slate-400 text-xs font-medium">+{attendees.length - 20}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Associated sets */}
        {jamSets.length > 0 ? (
          <View className="px-4 mb-10">
            <Text className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-3">
              Sets
            </Text>
            {jamSets.map(s => (
              <TouchableOpacity
                key={s.id}
                onPress={() => router.push(`/set/${s.id}` as any)}
                className="flex-row items-center py-3 border-b border-slate-100"
              >
                <Ionicons name="list-outline" size={16} color="#94a3b8" style={{ marginRight: 10 }} />
                <Text className="flex-1 text-slate-900">{s.name}</Text>
                <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}
