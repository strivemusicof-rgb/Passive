import type { LeaderboardEntry, LeaderboardResponse, LeaderboardScope } from '@landrush/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { CoinIcon, formatNumber, GemIcon } from '@/components/ui/currency';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { C, S } from '@/constants/theme';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';

const PODIUM = [
  { bg: 'rgba(231,179,60,0.28)', border: '#E7B33C' },
  { bg: 'rgba(154,164,174,0.2)', border: '#9AA4AE' },
  { bg: 'rgba(179,112,58,0.25)', border: '#B3703A' },
];
const DAY_MS = 86_400_000;

/** 11. Leaderboard. */
export default function LeaderboardRoute() {
  const { t } = useTranslation();
  const [scope, setScope] = useState<LeaderboardScope>('all');
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [daysLeft, setDaysLeft] = useState(0);
  const [reload, setReload] = useState(0);

  useFocusEffect(useCallback(() => setReload((n) => n + 1), []));

  useEffect(() => {
    let cancelled = false;
    api
      .leaderboard(scope)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
        setDaysLeft(Math.max(1, Math.ceil((new Date(d.monthEndsAt).getTime() - Date.now()) / DAY_MS)));
      })
      .catch((e) => !cancelled && setError(errorMessage(t, e)));
    return () => {
      cancelled = true;
    };
  }, [scope, reload, t]);

  const month = scope === 'month';
  const shown = data?.scope === scope ? data : null;
  const meInTop = shown?.me && shown.entries.some((e) => e.userId === shown.me!.userId);

  return (
    <Screen tabs>
      <Text variant="h1">{t('leaderboard.title')}</Text>
      <Segmented
        options={(['all', 'month', 'near'] as const).map((s) => ({ value: s, label: t(`leaderboard.${s}`) }))}
        value={scope}
        onChange={setScope}
      />

      {month && shown && shown.monthlyPrizeGems.length > 0 && (
        <Card style={styles.prizes}>
          <View style={styles.between}>
            <Text variant="bodyBold">{t('leaderboard.prizes')}</Text>
            <Text variant="tiny" color={C.coin}>
              {t('leaderboard.endsIn', { count: daysLeft })}
            </Text>
          </View>
          <View style={styles.prizeRow}>
            {shown.monthlyPrizeGems.slice(0, 3).map((gems, i) => (
              <View key={i} style={[styles.prize, { borderColor: PODIUM[i].border, backgroundColor: PODIUM[i].bg }]}>
                <Text variant="smallBold">{i + 1}.</Text>
                <GemIcon size={14} />
                <Text variant="smallBold">{gems}</Text>
              </View>
            ))}
            {shown.monthlyPrizeGems.length > 3 && (
              <Text variant="tiny" color={C.textSecondary}>
                4–{shown.monthlyPrizeGems.length}: +{shown.monthlyPrizeGems[shown.monthlyPrizeGems.length - 1]}
              </Text>
            )}
          </View>
          <Text variant="tiny" color={C.textSecondary}>
            {t('leaderboard.monthHint')}
          </Text>
        </Card>
      )}
      {scope === 'near' && (
        <Text variant="small" color={C.textSecondary}>
          {t('leaderboard.nearHint')}
        </Text>
      )}

      {error && <Text color={C.danger}>{error}</Text>}
      {!shown ? (
        !error && <ActivityIndicator color={C.green} />
      ) : shown.entries.length === 0 ? (
        <Text color={C.textSecondary} center style={styles.empty}>
          {t('leaderboard.empty')}
        </Text>
      ) : (
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
            <Text variant="tiny" color={C.textMuted} style={[styles.score, styles.right]}>
              {month ? t('leaderboard.coinsMonth') : t('leaderboard.income')}
            </Text>
          </View>
          {shown.entries.map((e) => (
            <Row key={e.userId} e={e} month={month} me={e.userId === shown.me?.userId} />
          ))}
          {shown.me && !meInTop && (
            <>
              <Text variant="tiny" color={C.textMuted} center>
                ⋯
              </Text>
              <Row e={shown.me} month={month} me />
            </>
          )}
        </Card>
      )}

      {month && shown && shown.lastWinners.length > 0 && (
        <>
          <Text variant="h3">{t('leaderboard.lastWinners')}</Text>
          <Card style={styles.table}>
            {shown.lastWinners.slice(0, 3).map((w) => (
              <View key={w.rank} style={styles.row}>
                <Text variant="smallBold" style={styles.rank}>
                  {w.rank}
                </Text>
                <Text variant="smallBold" style={styles.player} numberOfLines={1}>
                  {w.displayName}
                </Text>
                <View style={styles.scoreCell}>
                  <GemIcon size={14} />
                  <Text variant="smallBold">{w.gems}</Text>
                </View>
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

function Row({ e, month, me }: { e: LeaderboardEntry; month: boolean; me: boolean }) {
  const { t } = useTranslation();
  const podium = PODIUM[e.rank - 1];
  return (
    <View
      style={[
        styles.row,
        podium && { backgroundColor: podium.bg, borderColor: podium.border, borderWidth: 1 },
        me && !podium && styles.meRow,
      ]}>
      <Text variant="smallBold" style={styles.rank}>
        {e.rank}
      </Text>
      <View style={[styles.player, styles.playerCell]}>
        <Avatar name={e.displayName} size={24} frame={e.style.frame} />
        <Text variant="smallBold" numberOfLines={1} style={styles.flex} color={e.style.nameColor ?? undefined}>
          {e.displayName}
          {me ? ` (${t('leaderboard.you')})` : ''}
        </Text>
      </View>
      <Text variant="smallBold" style={styles.plots}>
        {e.plots}
      </Text>
      <View style={[styles.score, styles.scoreCell]}>
        <CoinIcon size={14} />
        <Text variant="smallBold">{formatNumber(month ? e.score : e.incomePerHour)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  table: { paddingVertical: S.xs, paddingHorizontal: S.xs },
  headRow: { flexDirection: 'row', paddingHorizontal: S.sm, paddingVertical: S.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.sm, height: 42, borderRadius: 6, marginBottom: 2 },
  meRow: { backgroundColor: 'rgba(52,199,89,0.14)', borderColor: C.green, borderWidth: 1 },
  rank: { width: 28 },
  player: { flex: 1 },
  playerCell: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  flex: { flex: 1 },
  plots: { width: 52, textAlign: 'right' },
  score: { width: 86 },
  right: { textAlign: 'right' },
  scoreCell: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  empty: { marginTop: S.lg },
  prizes: { padding: S.md, gap: S.sm, borderColor: '#5A4A1A' },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  prizeRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, flexWrap: 'wrap' },
  prize: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
});
