import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image, Text, View } from 'react-native';
import type { ColorValue } from 'react-native';
import { useAuth } from '@/lib/auth-context';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function icon(outline: IoniconName, filled: IoniconName) {
  return ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? filled : outline} size={22} color={color as string} />
  );
}

function ProfileTabIcon({
  focused,
  signedIn,
  avatarUrl,
  initial,
}: {
  focused: boolean;
  signedIn: boolean;
  avatarUrl: string | null;
  initial: string;
}) {
  if (!signedIn) {
    return <Ionicons name="log-in-outline" size={22} color="#94a3b8" />;
  }
  return (
    <View
      className={`w-6 h-6 rounded-full overflow-hidden items-center justify-center ${
        focused ? 'border-2 border-amber-500' : ''
      } ${avatarUrl ? '' : 'bg-slate-600'}`}
    >
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} className="w-full h-full" />
      ) : (
        <Text className="text-slate-200 text-[10px] font-medium">{initial}</Text>
      )}
    </View>
  );
}

export default function TabLayout() {
  const { session, profile } = useAuth();
  const signedIn = !!session;
  const initial = (profile?.display_name ?? profile?.username ?? '?')[0].toUpperCase();

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        tabBarActiveTintColor: '#f59e0b',
        tabBarInactiveTintColor: '#94a3b8',
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="jams"
        options={{ title: 'Jams', tabBarIcon: icon('calendar-outline', 'calendar') }}
      />
      <Tabs.Screen
        name="sets"
        options={{ title: 'Sets', tabBarIcon: icon('list-outline', 'list') }}
      />
      <Tabs.Screen
        name="index"
        options={{ title: 'Repertoire', tabBarIcon: icon('musical-notes-outline', 'musical-notes') }}
      />
      <Tabs.Screen
        name="friends"
        options={{ title: 'Friends', tabBarIcon: icon('people-outline', 'people') }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: signedIn ? 'Profile' : 'Sign in',
          tabBarIcon: ({ focused }) => (
            <ProfileTabIcon
              focused={focused}
              signedIn={signedIn}
              avatarUrl={profile?.avatar_url ?? null}
              initial={initial}
            />
          ),
        }}
      />
    </Tabs>
  );
}
