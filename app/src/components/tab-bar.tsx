import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { C, TAB_BAR_HEIGHT } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

export const TABS: { name: string; label: 'map' | 'lands' | 'build' | 'shop' | 'more'; icon: IconName; iconActive: IconName }[] = [
  { name: 'map', label: 'map', icon: 'map-outline', iconActive: 'map' },
  { name: 'lands', label: 'lands', icon: 'home-outline', iconActive: 'home' },
  { name: 'build', label: 'build', icon: 'construct-outline', iconActive: 'construct' },
  { name: 'shop', label: 'shop', icon: 'storefront-outline', iconActive: 'storefront' },
  { name: 'more', label: 'more', icon: 'menu-outline', iconActive: 'menu' },
];

/** Screens reached from "More" keep the More tab highlighted. */
const PARENT: Record<string, string> = {
  missions: 'more',
  marketplace: 'more',
  leaderboard: 'more',
  profile: 'more',
  settings: 'more',
  badges: 'more',
};

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const routeName = state.routes[state.index].name;
  const activeTab = PARENT[routeName] ?? routeName;

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom, height: TAB_BAR_HEIGHT + insets.bottom }]}>
      {TABS.map((tab) => {
        const active = tab.name === activeTab;
        const color = active ? C.green : C.textSecondary;
        return (
          <Pressable key={tab.name} style={styles.item} onPress={() => navigation.navigate(tab.name)}>
            <Ionicons name={active ? tab.iconActive : tab.icon} size={22} color={color} />
            <Text variant="tiny" color={color} numberOfLines={1}>
              {t(`tabs.${tab.label}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: '#0A100E',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#22302A',
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
});
