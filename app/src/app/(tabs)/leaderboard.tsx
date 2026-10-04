import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { CoinIcon, formatNumber } from '@/components/ui/currency';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { C, S } from '@/constants/theme';
import { leaderboard } from '@/mock/data';

const PODIUM = [
  { bg: 'rgba(231,179,60,0.28)', border: '#E7B33C' },
  { bg: 'rgba(154,164,174,0.2)', border: '#9AA4AE' },
  { bg: 'rgba(179,112,58,0.25)', border: '#B3703A' },
];

/** 11. Leaderboard. */
export default function LeaderboardRoute() {
  const { t } = useTranslation();
  const [scope, setScope] = useState<'global' | 'country' | 'city' | 'district'>('global');

  return (
    <Screen tabs>
      <Text variant="h1">{t('leaderboard.title')}</Text>
      <Segmented
        options={(['global', 'country', 'city', 'district'] as const).map((s) => ({ value: s, label: t(`leaderboard.${s}`) }))}
        value={scope}
        onChange={setScope}
      />
      <Card style={styles.table}>
        <View style={styles.headRow}>
          <Text variant="tiny" color={C.textMuted} style={styles.rank}>
            #
          </Text>
          <Text variant="tiny" color={C.textMuted} style={styles.player}>
            {t('leaderboard.player')}
          </Text>
          <Text variant="tiny" color={C.textMuted} style={styles.plots}>
            {t('leaderboard.plots')}
          </Text>
          <Text variant="tiny" color={C.textMuted} style={styles.income}>
            {t('leaderboard.income')}
          </Text>
        </View>
        {leaderboard.map((p, i) => {
          const podium = PODIUM[i];
          return (
            <View
              key={p.name}
              style={[styles.row, podium && { backgroundColor: podium.bg, borderColor: podium.border, borderWidth: 1 }]}>
              <Text variant="smallBold" style={styles.rank}>
                {i + 1}
              </Text>
              <View style={[styles.player, styles.playerCell]}>
                <Avatar name={p.name} size={24} />
                <Text variant="smallBold" numberOfLines={1}>
                  {p.name}
                </Text>
              </View>
              <Text variant="smallBold" style={styles.plots}>
                {p.plots}
              </Text>
              <View style={[styles.income, styles.incomeCell]}>
                <CoinIcon size={14} />
                <Text variant="smallBold">{formatNumber(p.income)}</Text>
              </View>
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  table: { paddingVertical: S.xs, paddingHorizontal: S.xs },
  headRow: { flexDirection: 'row', paddingHorizontal: S.sm, paddingVertical: S.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.sm, height: 42, borderRadius: 6, marginBottom: 2 },
  rank: { width: 24 },
  player: { flex: 1 },
  playerCell: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  plots: { width: 48, textAlign: 'right' },
  income: { width: 78, textAlign: 'right' },
  incomeCell: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
});
