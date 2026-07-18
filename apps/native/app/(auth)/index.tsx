import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';

export default function WelcomeScreen() {
  const router = useRouter();
  const { continueAsGuest } = useAuth();

  function browseAsGuest() {
    continueAsGuest();
    router.replace('/(tabs)');
  }

  return (
    <View className="flex-1 bg-slate-900">
      <View className="absolute -top-20 -right-16 w-72 h-72 rounded-full bg-amber-500/20" />
      <View className="absolute top-32 -left-24 w-56 h-56 rounded-full bg-amber-500/10" />

      <View className="flex-1 justify-between px-6 pt-16 pb-10">
        <View className="flex-1">
          <View className="items-center pt-4">
            <Image
              source={require('../../assets/icon.png')}
              className="w-20 h-20 rounded-2xl"
            />
            <Text className="text-3xl font-bold text-white mt-3">SingJam</Text>
          </View>

          <View className="flex-1 justify-center">
            <Text className="text-4xl font-bold tracking-tight text-white leading-tight">
              Build your repertoire.
            </Text>
            <Text className="text-4xl font-bold tracking-tight text-amber-400 leading-tight">
              Sing and jam with friends.
            </Text>
          </View>
        </View>

        <View>
          <TouchableOpacity
            className="bg-amber-500 rounded-xl py-3.5 items-center mb-3"
            onPress={() => router.push('/(auth)/sign-in?mode=signup' as any)}
          >
            <Text className="text-white font-semibold text-base">Get started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="border border-slate-600 rounded-xl py-3.5 items-center mb-6"
            onPress={() => router.push('/(auth)/sign-in?mode=signin' as any)}
          >
            <Text className="text-white font-semibold text-base">Sign in</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={browseAsGuest} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text className="text-center text-slate-400 text-sm">Continue as Guest</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
