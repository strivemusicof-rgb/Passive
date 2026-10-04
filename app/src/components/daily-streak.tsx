import { Ionicons } from '@expo/vector-icons';
import type { DailyRewardDto } from '@landrush/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CoinIcon, formatNumber, GemIcon } from '@/components/ui/currency';
import { Text } from '@/components/ui/text';
import { C, R, S } from '@/constants/theme';
import { errorMessage } from '@/lib/error-message';
import { game } from '@/lib/game';

/** 7 boxes (day 1 … 7) with today's reward highlighted and a Claim button. */
export function DailyStreak({
  daily,
  onClaimed,
}: {
  daily: DailyRewardDto;
  onClaimed?: (text: string) => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const claim = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await game.claimDaily();
      const parts = [
        res.coins > 0 && `+${formatNumber(res.coins)} 🪙`,
        res.gems > 0 && `+${res.gems} 💎`,
      ].filter(Boolean);
      onClaimed?.(
        `${parts.join('  ')}${res.leveledUp ? `  ·  ${t('progress.levelUp', { level: res.user.level })}` : ''}`,
      );
    } catch (e) {
      setError(errorMessage(t, e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Text variant="bodyBold">{t('daily.title')}</Text>
        <Text variant="small" color={C.textSecondary}>
          {t('daily.streak', {
            day: daily.claimedToday ? daily.streakDay : Math.max(daily.nextDay - 1, 0),
          })}
        </Text>
      </View>
      <View style={styles.days}>
        {daily.rewards.map((r, i) => {
          const day = i + 1;
          const done = daily.claimedToday ? day <= daily.streakDay : day < daily.nextDay;
          const today = !daily.claimedToday && day === daily.nextDay;
          return (
            <View
              key={day}
              style={[
                styles.day,
                done && styles.done,
                today && styles.today,
                day === 7 && styles.big,
              ]}>
              <Text variant="tiny" color={today ? C.green : C.textSecondary}>
                {t('daily.day', { day })}
              </Text>
              {done ? (
                <Ionicons name="checkmark-circle" size={20} color={C.green} />
              ) : r.gems > 0 && r.coins === 0 ? (
                <GemIcon size={18} />
              ) : (
                <CoinIcon size={18} />
              )}
              <Text variant="tiny">{r.coins > 0 ? formatNumber(r.coins) : `${r.gems}`}</Text>
              {r.coins > 0 && r.gems > 0 && (
                <Text variant="tiny" color={C.gem}>
                  +{r.gems}💎
                </Text>
              )}
            </View>
          );
        })}
      </View>
      {daily.claimedToday ? (
        <Text variant="small" color={C.textSecondary} center>
          {t('daily.comeBack')}
        </Text>
      ) : (
        <Button title={t('daily.claim', { day: daily.nextDay })} onPress={claim} disabled={busy} />
      )}
      {error && (
        <Text variant="small" color={C.danger} center>
          {error}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: S.md, gap: S.md },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  days: { flexDirection: 'row', gap: 4 },
  day: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: S.sm,
    borderRadius: R.sm,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  big: { flex: 1.3 },
  done: { opacity: 0.55 },
  today: { borderColor: C.green, backgroundColor: C.greenSoft },
});
