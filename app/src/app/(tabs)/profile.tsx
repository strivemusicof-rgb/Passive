import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { formatNumber } from '@/components/ui/currency';
import { Header } from '@/components/ui/header';
import { MenuRow } from '@/components/ui/menu-row';
import { Progress } from '@/components/ui/progress';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { C, S } from '@/constants/theme';
import { me } from '@/mock/data';

/** 12. Profile. */
export default function ProfileRoute() {
  const { t } = useTranslation();
  return (
    <Screen tabs>
      <Header
        title={t('profile.title')}
        right={
          <Pressable hitSlop={12} onPress={() => router.push('/settings')}>
            <Ionicons name="settings-outline" size={24} color={C.text} />
          </Pressable>
        }
      />
      <View style={styles.hero}>
        <View>
          <Avatar name={me.name} size={92} ring={C.green} />
          <View style={styles.verified}>
            <Ionicons name="shield-checkmark" size={14} color="#fff" />
          </View>
        </View>
        <View style={styles.heroText}>
          <Text variant="h2">{me.name}</Text>
          <Text variant="small" color={C.textSecondary}>
            {t('common.lv', { level: me.level })}
          </Text>
          <Progress value={me.xp / me.xpNext} height={6} />
          <Text variant="tiny" color={C.textSecondary}>
            {formatNumber(me.xp)} / {formatNumber(me.xpNext)} XP
          </Text>
        </View>
      </View>

      <Card style={styles.stats}>
        <Stat value={me.plots} label={t('profile.plots')} />
        <View style={styles.vline} />
        <Stat value={me.districts} label={t('profile.districts')} />
        <View style={styles.vline} />
        <Stat value={me.achievements} label={t('profile.achievements')} />
      </Card>

      <Card>
        <MenuRow icon="swap-horizontal-outline" label={t('profile.trading')} />
        <MenuRow icon="bar-chart-outline" label={t('profile.statistics')} />
        <MenuRow icon="ribbon-outline" label={t('profile.badges')} />
        <MenuRow icon="settings-outline" label={t('profile.settings')} onPress={() => router.push('/settings')} />
        <MenuRow icon="help-circle-outline" label={t('profile.help')} last />
      </Card>
    </Screen>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="h2">{value}</Text>
      <Text variant="tiny" color={C.textSecondary}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: S.lg, marginVertical: S.sm },
  verified: {
    position: 'absolute',
    right: 2,
    bottom: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2F7CF6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.bg,
  },
  heroText: { flex: 1, gap: 4 },
  stats: { flexDirection: 'row', paddingVertical: S.md },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  vline: { width: StyleSheet.hairlineWidth, backgroundColor: C.divider },
});
