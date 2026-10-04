import { RARITIES, type Rarity } from '@landrush/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { BUILDING_BY_LEVEL } from '@/components/art/plot-art';
import { PlotThumb } from '@/components/plot-thumb';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Amount } from '@/components/ui/currency';
import { RarityBadge } from '@/components/ui/rarity-badge';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { C, S } from '@/constants/theme';
import { perHour, useGame } from '@/lib/game';

/** 6. My lands. */
export default function LandsRoute() {
  const { t } = useTranslation();
  const { myPlots, income } = useGame();
  const [filter, setFilter] = useState<'all' | Rarity>('all');
  const plots = (myPlots ?? []).filter((p) => filter === 'all' || p.rarity === filter);
  const options = [
    { value: 'all' as const, label: t('lands.all') },
    ...RARITIES.map((r) => ({ value: r, label: t(`rarity.${r}`) })),
  ];

  return (
    <Screen tabs>
      <Text variant="h1">{t('lands.title')}</Text>
      <View style={styles.summary}>
        <Text color={C.textSecondary}>{t('lands.count', { count: myPlots?.length ?? 0 })}</Text>
        <View style={styles.total}>
          <Text variant="small" color={C.textSecondary}>
            {t('lands.totalIncome')}
          </Text>
          <Amount
            value={perHour(income?.perDay ?? 0)}
            suffix={` ${t('common.coinsPerHour')}`}
            variant="h3"
            color={C.coin}
            iconSize={22}
          />
        </View>
      </View>
      <Segmented options={options} value={filter} onChange={setFilter} />
      {myPlots === null && <ActivityIndicator color={C.green} />}
      {myPlots?.length === 0 && (
        <Card style={styles.empty}>
          <Text color={C.textSecondary} center>
            {t('lands.empty')}
          </Text>
          <Button title={t('lands.goToMap')} onPress={() => router.navigate('/map')} />
        </Card>
      )}
      {plots.map((p) => {
        const kind = BUILDING_BY_LEVEL[p.buildingLevel] ?? 'empty';
        const name = t(`building.${kind}`);
        return (
          <Pressable key={p.key} onPress={() => router.push(`/plot/${p.key}`)}>
            <Card style={styles.row}>
              <PlotThumb kind={kind} />
              <View style={styles.info}>
                <Text variant="bodyBold">#{p.number}</Text>
                <Text variant="small" color={C.textSecondary}>
                  {p.buildingLevel === 0
                    ? name
                    : t('building.withLevel', { name, level: p.buildingLevel })}
                </Text>
                <Amount
                  value={p.incomePerDay}
                  suffix={t('common.perDay')}
                  variant="smallBold"
                  iconSize={14}
                />
              </View>
              <RarityBadge rarity={p.rarity} />
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: -S.sm,
  },
  total: { alignItems: 'flex-end', gap: 2 },
  empty: { padding: S.lg, gap: S.md },
  row: { flexDirection: 'row', alignItems: 'center', padding: S.sm, gap: S.md },
  info: { flex: 1, gap: 2 },
});
