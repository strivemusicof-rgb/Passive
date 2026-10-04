import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Amount } from '@/components/ui/currency';
import { Progress } from '@/components/ui/progress';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { C, S } from '@/constants/theme';
import { dailyMissions, weeklyMissions, type Mission } from '@/mock/data';

type IconName = keyof typeof Ionicons.glyphMap;
const ICONS: Record<Mission['icon'], IconName> = {
  cash: 'cash-outline',
  'arrow-up': 'arrow-up-circle-outline',
  cart: 'cart-outline',
  play: 'play-circle-outline',
  calendar: 'calendar-outline',
  pricetag: 'pricetag-outline',
};

/** 10. Missions (daily + weekly). */
export default function MissionsRoute() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'daily' | 'weekly'>('daily');
  const missions = tab === 'daily' ? dailyMissions : weeklyMissions;

  return (
    <Screen tabs>
      <Text variant="h1">{t('missions.title')}</Text>
      <Segmented
        variant="bar"
        options={[
          { value: 'daily', label: t('missions.daily') },
          { value: 'weekly', label: t('missions.weekly') },
        ]}
        value={tab}
        onChange={setTab}
      />
      {missions.map((m) => {
        const done = m.progress >= m.target;
        return (
          <Card key={m.id} style={styles.row}>
            <View style={styles.icon}>
              <Ionicons name={ICONS[m.icon]} size={22} color="#06200D" />
            </View>
            <View style={styles.info}>
              <Text variant="bodyBold">{t(`missions.${m.key}`)}</Text>
              <View style={styles.progressRow}>
                <Text variant="small" color={C.textSecondary}>
                  {m.progress}/{m.target}
                </Text>
                {done ? <Progress value={1} height={4} /> : <View style={styles.flex} />}
                <Amount value={m.reward} variant="smallBold" iconSize={14} />
              </View>
            </View>
            {done ? (
              <View style={styles.done}>
                <Ionicons name="checkmark" size={20} color="#06200D" />
              </View>
            ) : (
              <Button title={t('common.go')} size="sm" variant="blue" style={styles.go} />
            )}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: S.md, gap: S.md },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 6 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  flex: { flex: 1 },
  go: { minWidth: 48 },
  done: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
});
