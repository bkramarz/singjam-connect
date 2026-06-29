import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function icon(outline: IoniconName, filled: IoniconName) {
  return ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? filled : outline} size={22} color={color as string} />
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#d97706',
        tabBarInactiveTintColor: '#94a3b8',
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Repertoire', tabBarIcon: icon('musical-notes-outline', 'musical-notes') }}
      />
      <Tabs.Screen
        name="jams"
        options={{ title: 'Jams', tabBarIcon: icon('calendar-outline', 'calendar') }}
      />
      <Tabs.Screen
        name="friends"
        options={{ title: 'Friends', tabBarIcon: icon('people-outline', 'people') }}
      />
      <Tabs.Screen
        name="sets"
        options={{ title: 'Sets', tabBarIcon: icon('list-outline', 'list') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: icon('person-outline', 'person') }}
      />
    </Tabs>
  );
}
