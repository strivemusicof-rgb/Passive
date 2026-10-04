import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { C, TAB_BAR_HEIGHT } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

export const TABS: {
  name: string;
  label: 'map' | 'lands' | 'build' | 'shop' | 'more';
  icon: IconName;
  iconActive: IconName;
}[] = [
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
  rewards: 'more',
};

/** Rounded bottom bar with dividers and a green underline on the active tab. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const routeName = state.routes[state.index].name;
  const activeTab = PARENT[routeName] ?? routeName;

  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: insets.bottom, height: TAB_BAR_HEIGHT + insets.bottom },
      ]}>
      {TABS.map((tab, i) => {
        const active = tab.name === activeTab;
        const color = active ? C.green : C.textSecondary;
        return (
          <View key={tab.name} style={styles.cell}>
            {i > 0 && <View style={styles.divider} />}
            <Pressable
              style={styles.item}
              onPress={() => navigation.navigate(tab.name)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}>
              <Ionicons name={active ? tab.iconActive : tab.icon} size={24} color={color} />
              <Text
                variant="small"
                color={color}
                numberOfLines={1}
                style={active && styles.activeLabel}>
                {t(`tabs.${tab.label}`)}
              </Text>
              <View style={[styles.underline, active && styles.underlineOn]} />
            </Pressable>
          </View>
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
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
  },
  cell: { flex: 1, flexDirection: 'row' },
  divider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingTop: 6 },
  activeLabel: { fontWeight: '700' },
  underline: {
    height: 3,
    width: 28,
    borderRadius: 2,
    marginTop: 3,
    backgroundColor: 'transparent',
  },
  underlineOn: { backgroundColor: C.green },
});
