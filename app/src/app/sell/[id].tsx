import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

import { BUILDING_BY_LEVEL, PlotArt } from '@/components/art/plot-art';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Amount, CoinIcon, formatNumber } from '@/components/ui/currency';
import { Header } from '@/components/ui/header';
import { RarityBadge } from '@/components/ui/rarity-badge';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { C, R, S } from '@/constants/theme';
import { errorMessage } from '@/lib/error-message';
import { game } from '@/lib/game';
import { usePlot } from '@/lib/use-plot';

/** 8. Sell land: put one of your plots on the marketplace (or take it off). */
export default function SellRoute() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { plot, setPlot, place } = usePlot(id);
  /** null until the player types: then the suggested price (1.5× value) is shown. */
  const [typed, setPrice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const price = typed ?? (plot?.sale ? String(Math.round((plot.sale.value * 1.5) / 10) * 10) : '');
  const value = Number(price) || 0;
  const feeRate = plot?.sale?.feeRate ?? 0.05;
  const fee = Math.round(value * feeRate);
  const inRange = !!plot?.sale && value >= plot.sale.min && value <= plot.sale.max;

  const list = async () => {
    if (!plot) return;
    setBusy(true);
    setMessage(null);
    try {
      const listing = await game.listPlot(plot.key, value);
      setPlot(listing.plot);
      setMessage({ text: t('sell.listed') });
      setTimeout(() => router.back(), 1200);
    } catch (e) {
      setMessage({ text: errorMessage(t, e), error: true });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!plot?.listing) return;
    setBusy(true);
    try {
      const listing = await game.cancelListing(plot.listing.id);
      setPlot(listing.plot);
      setMessage({ text: t('sell.cancelled') });
    } catch (e) {
      setMessage({ text: errorMessage(t, e), error: true });
    } finally {
      setBusy(false);
    }
  };

  if (!plot)
    return (
      <Screen>
        <ActivityIndicator color={C.green} />
      </Screen>
    );
  const kind = BUILDING_BY_LEVEL[plot.buildingLevel] ?? 'empty';

  return (
    <Screen>
      <Header title={t('sell.title')} close />
      <Card style={styles.plot}>
        <View style={styles.thumb}>
          <PlotArt kind={kind} size={110} />
        </View>
        <View style={styles.plotInfo}>
          <Text variant="h3">{t('common.plotId', { id: plot.number })}</Text>
          <Text variant="small" color={C.textSecondary}>
            {place ?? `${plot.lat.toFixed(4)}, ${plot.lng.toFixed(4)}`}
          </Text>
          <RarityBadge rarity={plot.rarity} />
          <Amount value={plot.incomePerDay} suffix={t('common.perDay')} />
        </View>
      </Card>

      {plot.listing ? (
        <Card style={styles.priceCard}>
          <Text variant="bodyBold">{t('sell.onSale', { price: formatNumber(plot.listing.price) })}</Text>
          <Button title={t('market.cancel')} variant="outline" onPress={cancel} disabled={busy} />
        </Card>
      ) : (
        <>
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
            {plot.sale && (
              <Text variant="small" color={inRange || !value ? C.textSecondary : C.danger}>
                {t('sell.range', { min: formatNumber(plot.sale.min), max: formatNumber(plot.sale.max) })}
              </Text>
            )}
          </Card>

          <Card>
            {plot.sale && (
              <View style={[styles.row, styles.border]}>
                <Text variant="small" color={C.textSecondary}>
                  {t('sell.value')}
                </Text>
                <Amount value={plot.sale.value} variant="smallBold" />
              </View>
            )}
            <View style={[styles.row, styles.border]}>
              <Text variant="small" color={C.textSecondary}>
                {t('sell.fee', { pct: Math.round(feeRate * 100) })}
              </Text>
              <Text variant="smallBold">- {formatNumber(fee)}</Text>
            </View>
            <View style={styles.row}>
              <Text variant="bodyBold">{t('sell.receive')}</Text>
              <Amount value={Math.max(0, value - fee)} />
            </View>
          </Card>

          <Button title={t('sell.list')} style={styles.cta} onPress={list} disabled={busy || !inRange} />
          <Text variant="tiny" color={C.textMuted} center style={styles.note}>
            {t('sell.visible')}
          </Text>
        </>
      )}
      {message && (
        <Text variant="smallBold" color={message.error ? C.danger : C.green} center>
          {message.text}
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: 'row', padding: S.md, gap: S.md, alignItems: 'center' },
  thumb: {
    width: 110,
    height: 100,
    borderRadius: R.sm,
    backgroundColor: '#0B1310',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: S.lg,
    height: 50,
  },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.divider },
  cta: { marginTop: S.lg },
  note: { lineHeight: 16, fontWeight: '500' },
});
