import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Button } from '@/components/ui/button';
import { formatNumber } from '@/components/ui/currency';
import { Text } from '@/components/ui/text';
import { C, R, S } from '@/constants/theme';
import { errorMessage } from '@/lib/error-message';
import { estimatePending, game, perHour, useGame } from '@/lib/game';
import { allowReminders, scheduleStorageFull } from '@/lib/notifications';
import { useNow } from '@/lib/use-now';

/** "+N coins/h" with a live-counting Collect button (top of the map). */
export function CollectCard({ style }: { style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  const { income, incomeAt } = useGame();
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const pending = estimatePending(income, incomeAt, now);

  const collect = async () => {
    setBusy(true);
    try {
      const got = await game.collect();
      setMessage({ text: got > 0 ? `+${formatNumber(got)}` : t('collect.nothing') });
      // After the first collect, offer a reminder for when storage is full again.
      if (got > 0 && (await allowReminders())) scheduleStorageFull(game.snapshot().income?.fullAt ?? null);
    } catch (e) {
      setMessage({ text: errorMessage(t, e), error: true });
    } finally {
      setBusy(false);
      setTimeout(() => setMessage(null), 2500);
    }
  };

  return (
    <View style={[styles.card, style]}>
      <Text variant="h3" color={C.green} center>
        + {perHour(income?.perDay ?? 0)} {t('common.coinsPerHour')}
      </Text>
      {pending.full && (
        <Text variant="tiny" color={C.coin} center>
          {t('collect.full')}
        </Text>
      )}
      <Button
        title={pending.coins > 0 ? t('collect.button', { coins: formatNumber(pending.coins) }) : t('map.collect')}
        size="sm"
        style={styles.button}
        onPress={collect}
        disabled={busy || !income}
      />
      {message && (
        <Text variant="smallBold" color={message.error ? C.danger : C.coin} center>
          {message.text}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: S.md,
    borderRadius: R.lg,
    gap: S.sm,
    minWidth: 200,
    backgroundColor: 'rgba(10,16,14,0.88)',
    borderWidth: 1,
    borderColor: '#25332D',
  },
  button: { alignSelf: 'stretch' },
});
