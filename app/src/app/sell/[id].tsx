import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';

import { PlotArt } from '@/components/art/plot-art';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Amount, CoinIcon, formatNumber } from '@/components/ui/currency';
import { Header } from '@/components/ui/header';
import { RarityBadge } from '@/components/ui/rarity-badge';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { C, R, S } from '@/constants/theme';
import { findPlot, MARKET_FEE } from '@/mock/data';

/** 8. Sell land. */
export default function SellRoute() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const plot = findPlot(Number(id));
  const [price, setPrice] = useState('4500');
  const value = Number(price) || 0;
  const fee = Math.round(value * MARKET_FEE);

  return (
    <Screen>
      <Header title={t('sell.title')} close />
      <Card style={styles.plot}>
        <View style={styles.thumb}>
          <PlotArt kind={plot.building} size={110} />
        </View>
        <View style={styles.plotInfo}>
          <Text variant="h3">{t('common.plotId', { id: plot.id })}</Text>
          <Text variant="small" color={C.textSecondary}>
            {plot.city}
          </Text>
          <RarityBadge rarity={plot.rarity} />
          <Amount value={plot.incomePerDay} suffix={t('common.perDay')} />
        </View>
      </Card>

      <Card style={styles.priceCard}>
        <Text variant="bodyBold">{t('sell.setPrice')}</Text>
        <View style={styles.input}>
          <CoinIcon size={24} />
          <TextInput
            value={price}
            onChangeText={(v) => setPrice(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            style={styles.inputText}
            placeholderTextColor={C.textMuted}
          />
        </View>
      </Card>

      <Card>
        <View style={[styles.row, styles.border]}>
          <Text variant="small" color={C.textSecondary}>
            {t('sell.fee', { pct: MARKET_FEE * 100 })}
          </Text>
          <Text variant="smallBold">- {formatNumber(fee)}</Text>
        </View>
        <View style={styles.row}>
          <Text variant="bodyBold">{t('sell.receive')}</Text>
          <Amount value={value - fee} />
        </View>
      </Card>

      <Button title={t('sell.list')} style={styles.cta} onPress={() => router.back()} />
      <Text variant="tiny" color={C.textMuted} center style={styles.note}>
        {t('sell.visible')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: 'row', padding: S.md, gap: S.md, alignItems: 'center' },
  thumb: { width: 110, height: 100, borderRadius: R.sm, backgroundColor: '#0B1310', alignItems: 'center', justifyContent: 'center' },
  plotInfo: { flex: 1, gap: 6 },
  priceCard: { padding: S.lg, gap: S.md },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    height: 52,
    paddingHorizontal: S.lg,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: '#3A4843',
    backgroundColor: C.bg,
  },
  inputText: { flex: 1, minWidth: 0, color: C.text, fontSize: 22, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: S.lg, height: 50 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.divider },
  cta: { marginTop: S.lg },
  note: { lineHeight: 16, fontWeight: '500' },
});
