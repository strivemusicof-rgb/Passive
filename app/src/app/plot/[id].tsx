import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import type { Rarity } from '@landrush/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { BUILDING_BY_LEVEL, PlotArt } from '@/components/art/plot-art';
import { OddsCard } from '@/components/odds-card';
import { PlotLook } from '@/components/plot-look';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Amount, formatNumber } from '@/components/ui/currency';
import { Header } from '@/components/ui/header';
import { InfoRow } from '@/components/ui/info-row';
import { RarityBadge } from '@/components/ui/rarity-badge';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { C, R, RARITY_COLORS, S } from '@/constants/theme';
import { errorMessage } from '@/lib/error-message';
import { game, useGame } from '@/lib/game';
import { confirm } from '@/lib/confirm';
import { currentPosition } from '@/lib/location';
import { usePlot } from '@/lib/use-plot';

/** 5. Land details (owned or free). `id` is the plot's "row_col" key. */
export default function PlotRoute() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { plot, setPlot, place, error } = usePlot(id);
  const { wallet } = useGame();
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Rarity | null>(null);
  const [checkIn, setCheckIn] = useState<{ busy: boolean; text?: string; error?: boolean }>({ busy: false });

  if (error) {
    return (
      <Screen>
        <Header title={t('plot.free')} close />
        <Text color={C.danger}>{errorMessage(t, error)}</Text>
      </Screen>
    );
  }
  if (!plot) {
    return (
      <Screen>
        <ActivityIndicator color={C.green} style={styles.loading} />
      </Screen>
    );
  }

  const kind = BUILDING_BY_LEVEL[plot.buildingLevel] ?? 'empty';
  const buildingName = t(`building.${kind}`);
  const isFree = !plot.owner;
  const canAfford = wallet != null && plot.price != null && wallet.coins >= plot.price;

  const buy = async () => {
    setBuying(true);
    setBuyError(null);
    try {
      const bought = await game.buy(plot.key);
      setPlot(bought);
      setRevealed(bought.rarity);
    } catch (e) {
      setBuyError(errorMessage(t, e));
    } finally {
      setBuying(false);
    }
  };

  /** Buy it from the player selling it on the marketplace. */
  const buyListing = async () => {
    if (!plot.listing) return;
    const ok = await confirm(
      t('market.confirmTitle', { id: plot.number }),
      t('market.confirmBody', { price: formatNumber(plot.listing.price) }),
      t('common.buy'),
      t('account.cancel'),
    );
    if (!ok) return;
    setBuying(true);
    setBuyError(null);
    try {
      setPlot(await game.buyListing(plot.listing.id));
    } catch (e) {
      setBuyError(errorMessage(t, e));
    } finally {
      setBuying(false);
    }
  };

  /** Bonus for standing at your own plot (the server checks the distance). */
  const doCheckIn = async () => {
    setCheckIn({ busy: true });
    const pos = await currentPosition();
    if (!pos) return setCheckIn({ busy: false, text: t('checkIn.needLocation'), error: true });
    try {
      const res = await game.checkIn(plot.key, pos.lat, pos.lng);
      setCheckIn({
        busy: false,
        text: `${t('checkIn.done', { coins: res.coins, xp: res.xp })}${res.leveledUp ? `  ·  ${t('progress.levelUp', { level: res.user.level })}` : ''}`,
      });
    } catch (e) {
      setCheckIn({ busy: false, text: errorMessage(t, e), error: true });
    }
  };

  const footer = plot.mine ? (
    <>
      {checkIn.text && (
        <Text variant="smallBold" color={checkIn.error ? C.danger : C.coin} center>
          {checkIn.text}
        </Text>
      )}
      <Button
        variant="outline"
        title={t('checkIn.button')}
        icon={<Ionicons name="walk" size={18} color={C.text} />}
        onPress={doCheckIn}
        disabled={checkIn.busy}
      />
      {plot.nextLevel && (
        <Button
          title={t('plot.upgrade')}
          onPress={() => router.push({ pathname: '/build', params: { plot: plot.key } })}
        />
      )}
      <Button
        variant="outline"
        title={plot.listing ? t('plot.onSale', { price: formatNumber(plot.listing.price) }) : t('plot.sell')}
        onPress={() => router.push(`/sell/${plot.key}`)}
      />
    </>
  ) : plot.listing ? (
    <>
      {buyError && (
        <Text variant="small" color={C.danger} center>
          {buyError}
        </Text>
      )}
      <Text variant="small" color={C.textSecondary} center>
        {t('plot.forSaleBy', { name: plot.owner?.displayName ?? '' })}
      </Text>
      <Button
        title={t('plot.buyListing', { price: formatNumber(plot.listing.price) })}
        onPress={buyListing}
        disabled={buying || (wallet != null && wallet.coins < plot.listing.price)}
      />
    </>
  ) : isFree ? (
    <>
      {buyError && (
        <Text variant="small" color={C.danger} center>
          {buyError}
        </Text>
      )}
      {!canAfford && wallet && (
        <Text variant="small" color={C.textSecondary} center>
          {t('plot.notEnough')}
        </Text>
      )}
      <Button
        title={t('plot.buyFor', { price: formatNumber(plot.price ?? 0) })}
        onPress={buy}
        disabled={!canAfford || buying}
      />
    </>
  ) : null;

  return (
    <Screen footer={footer}>
      <Header
        title={plot.number ? t('common.plotId', { id: plot.number }) : t('plot.free')}
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
      {revealed && (
        <View style={[styles.reveal, { borderColor: RARITY_COLORS[revealed].map }]}>
          <Text variant="tiny" color={C.textSecondary}>
            {t('plot.revealTitle')}
          </Text>
          <Text variant="h2" color={RARITY_COLORS[revealed].map}>
            {t(`rarity.${revealed}`)}!
          </Text>
        </View>
      )}
      <RarityBadge rarity={plot.rarity} size="md" />
      {plot.boosted && (
        <View style={styles.landmark}>
          <Ionicons name="star" size={14} color={C.coin} />
          <Text variant="smallBold" color={C.coin}>
            {t('plot.landmark')}
          </Text>
        </View>
      )}
      <View style={styles.art}>
        <PlotArt kind={kind} size={230} />
      </View>
      <View style={styles.location}>
        <Ionicons name="location-sharp" size={18} color={C.textSecondary} />
        <View>
          {place && <Text variant="bodyBold">{place}</Text>}
          <Text variant="small" color={C.textSecondary}>
            {plot.lat.toFixed(4)}, {plot.lng.toFixed(4)}
          </Text>
        </View>
      </View>
      {isFree ? (
        <>
          {plot.odds && <OddsCard odds={plot.odds} />}
          <Card>
            <InfoRow label={t('plot.price')} last>
              <Amount value={plot.price ?? 0} variant="smallBold" />
            </InfoRow>
          </Card>
        </>
      ) : (
        <Card>
          <InfoRow label={t('plot.baseIncome')}>
            <Amount value={plot.incomePerDay} suffix={t('common.perDay')} variant="smallBold" />
          </InfoRow>
          <InfoRow label={t('plot.building')}>
            <View style={styles.inline}>
              <Ionicons name="home-outline" size={15} color={C.text} />
              <Text variant="smallBold">
                {plot.buildingLevel === 0
                  ? buildingName
                  : t('building.withLevel', { name: buildingName, level: plot.buildingLevel })}
              </Text>
            </View>
          </InfoRow>
          {plot.mine && (
            <InfoRow label={t('plot.upgradeIncome')}>
              {plot.nextLevel ? (
                <View style={styles.inline}>
                  <Ionicons name="arrow-up-circle-outline" size={16} color={C.green} />
                  <Text variant="smallBold" color={C.green}>
                    +{plot.nextLevel.incomePerDay - plot.incomePerDay}
                    {t('common.perDay')}
                  </Text>
                </View>
              ) : (
                t('build.maxLevel')
              )}
            </InfoRow>
          )}
          {plot.neighbours > 0 && (
            <InfoRow label={t('plot.neighbours')}>
              <Text variant="smallBold" color={C.green}>
                {t('plot.neighbourBonus', { count: plot.neighbours, pct: plot.neighbours * 5 })}
              </Text>
            </InfoRow>
          )}
          <InfoRow label={t('plot.owner')}>
            <Text variant="smallBold" color={plot.owner?.style.nameColor ?? undefined}>
              {plot.mine ? t('common.you') : (plot.owner?.displayName ?? t('plot.nobody'))}
            </Text>
          </InfoRow>
          <InfoRow label={t('plot.marketStatus')} last>
            {plot.listing ? t('plot.onSale', { price: formatNumber(plot.listing.price) }) : t('plot.notForSale')}
          </InfoRow>
        </Card>
      )}
      {plot.mine && <PlotLook plot={plot} onChange={setPlot} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 120 },
  reveal: {
    alignItems: 'center',
    padding: S.md,
    borderRadius: R.md,
    borderWidth: 2,
    backgroundColor: C.card,
    gap: 2,
  },
  landmark: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
