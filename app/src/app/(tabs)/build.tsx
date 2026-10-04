import { Ionicons } from '@expo/vector-icons';
import type { PlotDto } from '@landrush/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { BUILDING_BY_LEVEL } from '@/components/art/plot-art';
import { PlotThumb } from '@/components/plot-thumb';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Amount, CoinIcon, formatNumber } from '@/components/ui/currency';
import { RarityBadge } from '@/components/ui/rarity-badge';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { C, R, S } from '@/constants/theme';
import { errorMessage } from '@/lib/error-message';
import { game, useGame } from '@/lib/game';

/** 9. Buildings: pick one of your plots, then build the next level on it. */
export default function BuildRoute() {
  const { t } = useTranslation();
  const { plot: plotKey } = useLocalSearchParams<{ plot?: string }>();
  const { myPlots } = useGame();
  const plot = myPlots?.find((p) => p.key === plotKey);

  return (
    <Screen tabs>
      <View>
        <Text variant="h1">{t('build.title')}</Text>
        <Text variant="small" color={C.textSecondary}>
          {t('build.subtitle')}
        </Text>
      </View>
      {myPlots === null && <ActivityIndicator color={C.green} />}
      {plot ? <Catalogue plot={plot} /> : <PlotPicker plots={myPlots ?? []} />}
    </Screen>
  );
}

function PlotPicker({ plots }: { plots: PlotDto[] }) {
  const { t } = useTranslation();
  return (
    <>
      <StorageCard />
      <Text variant="h3">{t('build.choosePlot')}</Text>
      {plots.length === 0 && <Text color={C.textSecondary}>{t('lands.empty')}</Text>}
      {plots.map((p) => {
        const kind = BUILDING_BY_LEVEL[p.buildingLevel] ?? 'empty';
        return (
          <Pressable key={p.key} onPress={() => router.setParams({ plot: p.key })}>
            <Card style={styles.row}>
              <PlotThumb kind={kind} />
              <View style={styles.info}>
                <Text variant="bodyBold">
                  #{p.number} · {t(`building.${kind}`)}
                </Text>
                <Amount
                  value={p.incomePerDay}
                  suffix={t('common.perDay')}
                  variant="small"
                  iconSize={14}
                />
              </View>
              {p.nextLevel ? (
                <View style={styles.cost}>
                  <CoinIcon size={14} />
                  <Text variant="smallBold">{formatNumber(p.nextLevel.cost)}</Text>
                </View>
              ) : (
                <Text variant="small" color={C.green}>
                  {t('build.maxLevel')}
                </Text>
              )}
            </Card>
          </Pressable>
        );
      })}
    </>
  );
}

function Catalogue({ plot }: { plot: PlotDto }) {
  const { t } = useTranslation();
  const { wallet, income } = useGame();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const costs = income?.buildingCost ?? [];
  const bonuses = income?.buildingIncome ?? [];

  const upgrade = async () => {
    setBusy(true);
    setError(null);
    try {
      await game.upgrade(plot.key);
    } catch (e) {
      setError(errorMessage(t, e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Pressable onPress={() => router.setParams({ plot: '' })} hitSlop={8} style={styles.back}>
        <Ionicons name="chevron-back" size={18} color={C.green} />
        <Text variant="small" color={C.green}>
          {t('build.allPlots')}
        </Text>
      </Pressable>
      <Card style={styles.summary}>
        <View style={styles.info}>
          <Text variant="h3">{t('common.plotId', { id: plot.number })}</Text>
          <Amount
            value={plot.incomePerDay}
            suffix={t('common.perDay')}
            variant="smallBold"
            iconSize={14}
          />
          {plot.neighbours > 0 && (
            <Text variant="tiny" color={C.green}>
              {t('plot.neighbourBonus', { count: plot.neighbours, pct: plot.neighbours * 5 })}
            </Text>
          )}
        </View>
        <RarityBadge rarity={plot.rarity} size="md" />
      </Card>

      {BUILDING_BY_LEVEL.map((kind, level) => {
        const current = level === plot.buildingLevel;
        const isNext = level === plot.buildingLevel + 1;
        const built = level < plot.buildingLevel;
        const cost = costs[level] ?? 0;
        const affordable = (wallet?.coins ?? 0) >= cost;
        return (
          <Card key={kind} style={[styles.row, current && styles.current]}>
            <PlotThumb kind={kind} size={64} />
            <View style={styles.info}>
              <Text variant="bodyBold">{t(`building.${kind}`)}</Text>
              <Amount
                value={`+${bonuses[level] ?? 0}`}
                suffix={t('common.perDay')}
                variant="small"
                iconSize={14}
              />
            </View>
            {current ? (
              <View style={styles.tag}>
                <Ionicons name="checkmark" size={18} color={C.green} />
                <Text variant="small" color={C.green}>
                  {t('common.current')}
                </Text>
              </View>
            ) : built ? (
              <Ionicons name="checkmark-done" size={18} color={C.textMuted} />
            ) : isNext ? (
              <Button
                title={formatNumber(cost)}
                size="sm"
                icon={<CoinIcon size={14} />}
                onPress={upgrade}
                disabled={busy || !affordable}
              />
            ) : (
              <View style={[styles.cost, styles.locked]}>
                <Ionicons name="lock-closed" size={12} color={C.textMuted} />
                <Text variant="smallBold" color={C.textMuted}>
                  {formatNumber(cost)}
                </Text>
              </View>
            )}
          </Card>
        );
      })}
      {error && (
        <Text variant="small" color={C.danger} center>
          {error}
        </Text>
      )}
      {plot.nextLevel && (wallet?.coins ?? 0) < plot.nextLevel.cost && (
        <Text variant="small" color={C.textSecondary} center>
          {t('plot.notEnough')}
        </Text>
      )}
    </>
  );
}

function StorageCard() {
  const { t } = useTranslation();
  const { income, wallet } = useGame();
  const [error, setError] = useState<string | null>(null);
  if (!income) return null;
  const next = income.nextStorage;
  const upgrade = async () => {
    setError(null);
    try {
      await game.upgradeStorage();
    } catch (e) {
      setError(errorMessage(t, e));
    }
  };
  return (
    <Card style={styles.storage}>
      <View style={styles.storageRow}>
        <Ionicons name="file-tray-full" size={22} color={C.coin} />
        <View style={styles.info}>
          <Text variant="bodyBold">{t('build.storage')}</Text>
          <Text variant="small" color={C.textSecondary}>
            {t('build.storageHours', { hours: income.storageHours })}
          </Text>
        </View>
        {next ? (
          <Button
            title={t('build.storageUpgrade', { hours: next.hours })}
            size="sm"
            onPress={upgrade}
            disabled={(wallet?.coins ?? 0) < next.cost}
          />
        ) : (
          <Text variant="small" color={C.green}>
            {t('build.maxLevel')}
          </Text>
        )}
      </View>
      {next && (
        <Text variant="tiny" color={C.textSecondary}>
          {t('build.storageCost', { cost: formatNumber(next.cost) })}
        </Text>
      )}
      {error && (
        <Text variant="small" color={C.danger}>
          {error}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: S.sm, gap: S.md },
  current: { borderColor: C.greenBorder },
  info: { flex: 1, gap: 4 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: S.sm },
  cost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: R.sm,
    backgroundColor: '#1A1F1C',
    borderWidth: 1,
    borderColor: '#3A3324',
  },
  locked: { borderColor: C.cardBorder },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  summary: { flexDirection: 'row', alignItems: 'center', padding: S.md, gap: S.md },
  storage: { padding: S.md, gap: S.sm },
  storageRow: { flexDirection: 'row', alignItems: 'center', gap: S.md },
});
