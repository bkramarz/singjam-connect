import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Alert, Image, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import SignInPrompt from '@/components/SignInPrompt';

type Profile = {
  display_name: string | null;
  last_name: string | null;
  username: string | null;
  avatar_url: string | null;
  singing_voice: string | null;
  neighborhood: string | null;
  instrument_levels: Record<string, string> | null;
};

type InstrumentLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Professional';

const LEVEL_STYLE: Record<InstrumentLevel, string> = {
  Beginner: 'bg-slate-100 text-slate-500',
  Intermediate: 'bg-sky-50 text-sky-700',
  Advanced: 'bg-amber-50 text-amber-700',
  Professional: 'bg-green-50 text-green-700',
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
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setEmail(user.email ?? null);
        const { data } = await supabase
          .from('profiles')
          .select('display_name, last_name, username, avatar_url, singing_voice, neighborhood, instrument_levels')
          .eq('id', user.id)
          .single();
        setProfile(data);
        setLoading(false);
      }
      load();
    }, [])
  );

  const { session, initialised } = useAuth();
  if (initialised && !session) return <SignInPrompt message="Sign in to see your profile" />;

  async function uploadAvatar(asset: ImagePicker.ImagePickerAsset) {
    setUploadingAvatar(true);
    try {
      const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const path = `${user.id}.${ext}`;
      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { contentType: asset.mimeType ?? 'image/jpeg', upsert: true });

      if (uploadError) { Alert.alert('Upload failed', uploadError.message); return; }

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id);
      setProfile(prev => prev ? { ...prev, avatar_url: avatarUrl } : prev);
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function pickFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to change your avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) await uploadAvatar(result.assets[0]);
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) await uploadAvatar(result.assets[0]);
  }

  function handleAvatarPress() {
    Alert.alert('Change Photo', undefined, [
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose from Library', onPress: pickFromLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

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

  const instrumentEntries = profile?.instrument_levels
    ? Object.entries(profile.instrument_levels).filter(([, level]) => level)
    : [];

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="flex-row justify-end px-4 pt-14 pb-0">
        <TouchableOpacity
          onPress={() => router.push('/notifications' as any)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="notifications-outline" size={22} color="#64748b" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <SkeletonProfile />
      ) : (
        <View className="items-center px-4 pt-4 pb-6 border-b border-slate-100">
          <TouchableOpacity onPress={handleAvatarPress} className="relative mb-3">
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} className="w-20 h-20 rounded-full" />
            ) : (
              <View className="w-20 h-20 rounded-full bg-amber-500 items-center justify-center">
                <Text className="text-white text-3xl font-semibold">{initial}</Text>
              </View>
            )}
            {uploadingAvatar ? (
              <View className="absolute inset-0 rounded-full bg-black/40 items-center justify-center">
                <ActivityIndicator color="white" size="small" />
              </View>
            ) : (
              <View className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-slate-700 items-center justify-center border-2 border-white">
                <Ionicons name="camera" size={10} color="white" />
              </View>
            )}
          </TouchableOpacity>
          <Text className="text-xl font-bold text-slate-900">{displayName}</Text>
          {profile?.username ? (
            <Text className="text-slate-400 mt-1">@{profile.username}</Text>
          ) : null}
          {singingLabels.length > 0 ? (
            <Text className="text-slate-400 text-sm mt-1">{singingLabels.join(' · ')}</Text>
          ) : null}
          {profile?.neighborhood ? (
            <View className="flex-row items-center mt-1 gap-1">
              <Ionicons name="location-outline" size={13} color="#94a3b8" />
              <Text className="text-slate-400 text-sm">{profile.neighborhood}</Text>
            </View>
          ) : null}
          {instrumentEntries.length > 0 ? (
            <View className="flex-row flex-wrap justify-center gap-2 mt-3 px-2">
              {instrumentEntries.map(([name, level]) => {
                const style = LEVEL_STYLE[level as InstrumentLevel] ?? 'bg-slate-100 text-slate-500';
                const [bgStyle, textStyle] = style.split(' ');
                return (
                  <View key={name} className={`flex-row items-center px-2.5 py-1 rounded-full ${bgStyle}`}>
                    <Text className={`text-xs font-medium ${textStyle}`}>{name} · {level}</Text>
                  </View>
                );
              })}
            </View>
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
        <TouchableOpacity
          onPress={() => router.push('/account' as any)}
          className="px-4 py-4 border-b border-slate-100"
        >
          <Text className="text-slate-900 font-medium">Account</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSignOut} className="px-4 py-4">
          <Text className="text-red-500 font-medium">Sign out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
