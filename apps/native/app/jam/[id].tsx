import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Image,
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

    const [jamResult, rsvpsResult, inviteResult] = await Promise.all([
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
    setLoading(false);
  }

  async function handleRsvp() {
    if (!myUserId || !jam) return;
    setRsvpLoading(true);
    const isFull = jam.capacity !== null && attendees.length >= jam.capacity;
    const newStatus = isFull ? 'waitlist' : 'attending';
    const { error } = await supabase
      .from('jam_rsvps')
      .upsert({ jam_id: jam.id, user_id: myUserId, status: newStatus }, { onConflict: 'jam_id,user_id' });
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setMyRsvpStatus(newStatus);
      if (newStatus === 'attending') {
        setAttendees(prev => [
          ...prev.filter(a => a.user_id !== myUserId),
          { user_id: myUserId, status: 'attending', display_name: null, username: null, avatar_url: null },
        ]);
      }
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
          const { error } = await supabase
            .from('jam_rsvps')
            .update({ status: 'cancelled' })
            .eq('jam_id', jam.id)
            .eq('user_id', myUserId);
          if (error) {
            Alert.alert('Error', error.message);
          } else {
            setMyRsvpStatus('cancelled');
            setAttendees(prev => prev.filter(a => a.user_id !== myUserId));
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
    await supabase
      .from('jam_invites')
      .update({ status: response })
      .eq('jam_id', jam.id)
      .eq('invitee_id', myUserId);
    if (response === 'accepted') {
      await supabase
        .from('jam_rsvps')
        .upsert({ jam_id: jam.id, user_id: myUserId, status: 'attending' }, { onConflict: 'jam_id,user_id' });
    }
    setMyInviteStatus(response);
    if (response === 'accepted') setMyRsvpStatus('attending');
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

  const isHosting = jam.host_id === myUserId;
  const isFull = jam.capacity !== null && attendees.length >= jam.capacity;
  const timeStr = formatJamTime(jam.starts_at, jam.timezone);
  const isPast = jam.starts_at ? new Date(jam.starts_at) < new Date() : false;

  return (
    <>
      <Stack.Screen
        options={{
          title: jam.name ?? 'Jam',
          headerTintColor: '#d97706',
          headerRight: isHosting ? () => (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/jam/edit' as any, params: { id: jam.id } })}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="pencil-outline" size={20} color="#d97706" />
            </TouchableOpacity>
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
              {jam.full_address ? (
                <Text className="text-slate-400 text-sm mt-0.5">{jam.full_address}</Text>
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
              <View className="bg-amber-50 rounded-xl py-3 items-center border border-amber-200">
                <Text className="text-amber-700 font-semibold">You're hosting this jam</Text>
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
          <View className="px-4 mb-10">
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
      </ScrollView>
    </>
  );
}
