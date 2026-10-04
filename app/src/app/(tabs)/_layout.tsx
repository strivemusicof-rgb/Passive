import { Tabs } from 'expo-router';

import { TabBar } from '@/components/tab-bar';
import { C } from '@/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.bg } }}>
      <Tabs.Screen name="map" />
      <Tabs.Screen name="lands" />
      <Tabs.Screen name="build" />
      <Tabs.Screen name="shop" />
      <Tabs.Screen name="more" />
      {/* Reached from the map buttons or More; keep the tab bar visible. */}
      <Tabs.Screen name="missions" options={{ href: null }} />
      <Tabs.Screen name="marketplace" options={{ href: null }} />
      <Tabs.Screen name="leaderboard" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="badges" options={{ href: null }} />
      <Tabs.Screen name="rewards" options={{ href: null }} />
    </Tabs>
  );
}
