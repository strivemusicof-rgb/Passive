import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { PlotArt } from '@/components/art/plot-art';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Amount } from '@/components/ui/currency';
import { Header } from '@/components/ui/header';
import { InfoRow } from '@/components/ui/info-row';
import { RarityBadge } from '@/components/ui/rarity-badge';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { C, R, S } from '@/constants/theme';
import { findPlot } from '@/mock/data';

/** 5. Land details. */
export default function PlotRoute() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const plot = findPlot(Number(id));
  const buildingName = t(`building.${plot.building}`);

  return (
    <Screen
      footer={
        plot.mine ? (
          <>
            <Button title={t('plot.upgrade')} onPress={() => router.push('/build')} />
            <Button variant="outline" title={t('plot.sell')} onPress={() => router.push(`/sell/${plot.id}`)} />
          </>
        ) : (
          <Button title={t('common.buy')} />
        )
      }>
      <Header
        title={t('common.plotId', { id: plot.id })}
        close
        right={
          plot.mine ? (
            <View style={styles.owned}>
              <View style={styles.dot} />
              <Text variant="tiny" color={C.green}>
                {t('plot.owned')}
              </Text>
            </View>
          ) : null
        }
      />
      <RarityBadge rarity={plot.rarity} size="md" />
      <View style={styles.art}>
        <PlotArt kind={plot.building} size={230} />
      </View>
      <View style={styles.location}>
        <Ionicons name="location-sharp" size={18} color={C.textSecondary} />
        <View>
          <Text variant="bodyBold">{plot.city}</Text>
          <Text variant="small" color={C.textSecondary}>
            {plot.lat.toFixed(4)}, {plot.lng.toFixed(4)}
          </Text>
        </View>
      </View>
      <Card>
        <InfoRow label={t('plot.baseIncome')}>
          <Amount value={plot.incomePerDay} suffix={t('common.perDay')} variant="smallBold" />
        </InfoRow>
        <InfoRow label={t('plot.building')}>
          <View style={styles.inline}>
            <Ionicons name="home-outline" size={15} color={C.text} />
            <Text variant="smallBold">
              {plot.building === 'empty' ? buildingName : t('building.withLevel', { name: buildingName, level: plot.level })}
            </Text>
          </View>
        </InfoRow>
        <InfoRow label={t('plot.upgradeIncome')}>
          <View style={styles.inline}>
            <Ionicons name="arrow-up-circle-outline" size={16} color={C.green} />
            <Text variant="smallBold" color={C.green}>
              +{plot.upgradeIncome}
              {t('common.perDay')}
            </Text>
          </View>
        </InfoRow>
        <InfoRow label={t('plot.owner')}>{plot.mine ? t('common.you') : 'BalticBaron'}</InfoRow>
        <InfoRow label={t('plot.marketStatus')} last>
          {plot.forSale ? t('plot.forSale') : t('plot.notForSale')}
        </InfoRow>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  owned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: R.pill,
    backgroundColor: C.greenSoft,
    borderWidth: 1,
    borderColor: C.greenBorder,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.green },
  art: { alignItems: 'center', marginTop: -S.xl },
  location: { flexDirection: 'row', gap: S.sm, alignItems: 'flex-start' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
