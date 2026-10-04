import { RARITIES, type Rarity } from '@landrush/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { PlotThumb } from '@/components/plot-thumb';
import { Card } from '@/components/ui/card';
import { Amount } from '@/components/ui/currency';
import { RarityBadge } from '@/components/ui/rarity-badge';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { C, S } from '@/constants/theme';
import { me, myPlots } from '@/mock/data';

/** 6. My lands. */
export default function LandsRoute() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<'all' | Rarity>('all');
  const plots = filter === 'all' ? myPlots : myPlots.filter((p) => p.rarity === filter);
  const options = [{ value: 'all' as const, label: t('lands.all') }, ...RARITIES.map((r) => ({ value: r, label: t(`rarity.${r}`) }))];

  return (
    <Screen tabs>
      <Text variant="h1">{t('lands.title')}</Text>
      <View style={styles.summary}>
        <Text color={C.textSecondary}>{t('lands.count', { count: me.plots })}</Text>
        <View style={styles.total}>
          <Text variant="small" color={C.textSecondary}>
            {t('lands.totalIncome')}
          </Text>
          <Amount value={me.incomePerHour} suffix={` ${t('common.coinsPerHour')}`} variant="h3" color={C.coin} iconSize={22} />
        </View>
      </View>
      <Segmented options={options} value={filter} onChange={setFilter} />
      {plots.map((p) => {
        const name = t(`building.${p.building}`);
        return (
          <Pressable key={p.id} onPress={() => router.push(`/plot/${p.id}`)}>
            <Card style={styles.row}>
              <PlotThumb kind={p.building} />
              <View style={styles.info}>
                <Text variant="bodyBold">#{p.id}</Text>
                <Text variant="small" color={C.textSecondary}>
                  {p.building === 'empty' ? name : t('building.withLevel', { name, level: p.level })}
                </Text>
                <Amount value={p.incomePerDay} suffix={t('common.perDay')} variant="smallBold" iconSize={14} />
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
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: -S.sm },
  total: { alignItems: 'flex-end', gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', padding: S.sm, gap: S.md },
  info: { flex: 1, gap: 2 },
});
