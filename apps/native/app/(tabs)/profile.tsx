import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Alert, Image, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';

type Profile = {
  display_name: string | null;
  last_name: string | null;
  username: string | null;
  avatar_url: string | null;
  singing_voice: string | null;
};

const SINGING_LABEL: Record<string, string> = {
  lead: 'Lead vocals',
  backup: 'Backup vocals',
};

function SkeletonProfile() {
  return (
    <View className="items-center pt-14 pb-6 border-b border-slate-100">
      <View className="w-20 h-20 rounded-full bg-slate-200 mb-3" />
      <View className="h-5 bg-slate-200 rounded w-36 mb-2" />
      <View className="h-4 bg-slate-100 rounded w-24" />
    </View>
  );
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setEmail(user.email ?? null);
        const { data } = await supabase
          .from('profiles')
          .select('display_name, last_name, username, avatar_url, singing_voice')
          .eq('id', user.id)
          .single();
        setProfile(data);
        setLoading(false);
      }
      load();
    }, [])
  );

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Sign out', style: 'destructive', onPress: () => supabase.auth.signOut() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  const fullName = [profile?.display_name, profile?.last_name].filter(Boolean).join(' ');
  const displayName = fullName || email || '';
  const initial = displayName[0]?.toUpperCase() ?? '?';

  const singingLabels = profile?.singing_voice
    ? profile.singing_voice.split(',').filter(Boolean).map(v => SINGING_LABEL[v] ?? v)
    : [];

  return (
    <ScrollView className="flex-1 bg-white">
      {loading ? (
        <SkeletonProfile />
      ) : (
        <View className="items-center px-4 pt-14 pb-6 border-b border-slate-100">
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} className="w-20 h-20 rounded-full mb-3" />
          ) : (
            <View className="w-20 h-20 rounded-full bg-amber-500 items-center justify-center mb-3">
              <Text className="text-white text-3xl font-semibold">{initial}</Text>
            </View>
          )}
          <Text className="text-xl font-bold text-slate-900">{displayName}</Text>
          {profile?.username ? (
            <Text className="text-slate-400 mt-1">@{profile.username}</Text>
          ) : null}
          {singingLabels.length > 0 ? (
            <Text className="text-slate-400 text-sm mt-1">{singingLabels.join(' · ')}</Text>
          ) : null}
        </View>
      )}

      <View className="mt-6 mx-4 rounded-xl border border-slate-100 overflow-hidden">
        <TouchableOpacity
          onPress={() => router.push('/profile-edit')}
          className="px-4 py-4 border-b border-slate-100"
        >
          <Text className="text-slate-900 font-medium">Edit Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSignOut} className="px-4 py-4">
          <Text className="text-red-500 font-medium">Sign out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
