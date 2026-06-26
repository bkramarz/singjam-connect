import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#d97706',
        tabBarInactiveTintColor: '#94a3b8',
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Repertoire' }} />
      <Tabs.Screen name="jams" options={{ title: 'Jams' }} />
      <Tabs.Screen name="friends" options={{ title: 'Friends' }} />
      <Tabs.Screen name="sets" options={{ title: 'Sets' }} />
    </Tabs>
  );
}
