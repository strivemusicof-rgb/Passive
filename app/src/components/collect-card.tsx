import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Button } from '@/components/ui/button';
import { CoinIcon, formatNumber } from '@/components/ui/currency';
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
      const { collected, points } = await game.collect();
      setMessage({
        text:
          collected > 0
            ? `+${formatNumber(collected)}${points > 0 ? `  ·  +${points} ⭐` : ''}`
            : t('collect.nothing'),
      });
      // After the first collect, offer a reminder for when storage is full again.
      if (collected > 0 && (await allowReminders()))
        scheduleStorageFull(game.snapshot().income?.fullAt ?? null);
    } catch (e) {
      setMessage({ text: errorMessage(t, e), error: true });
    } finally {
      setBusy(false);
      setTimeout(() => setMessage(null), 2500);
    }
  };

  return (
    <View style={[styles.card, style]}>
      <View style={styles.titleRow}>
        <Ionicons name="leaf" size={16} color={C.green} style={styles.leafLeft} />
        <CoinIcon size={22} />
        <Text style={styles.title}>
          + {perHour(income?.perDay ?? 0)} {t('common.coinsPerHour')}
        </Text>
        <Ionicons name="leaf" size={16} color={C.green} style={styles.leafRight} />
      </View>
      {pending.full && (
        <Text variant="tiny" color={C.coin} center>
          {t('collect.full')}
        </Text>
      )}
      <Button
        title={
          pending.coins > 0
            ? t('collect.button', { coins: formatNumber(pending.coins) })
            : t('map.collect')
        }
        icon={<CoinIcon size={18} />}
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
    paddingHorizontal: S.lg,
    borderRadius: R.lg + 4,
    gap: S.sm,
    minWidth: 250,
    backgroundColor: 'rgba(8,13,11,0.9)',
    borderWidth: 1.5,
    borderColor: C.green,
    // green glow around the card
    shadowColor: C.green,
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm },
  title: { fontSize: 22, fontWeight: '800', color: C.green },
  leafLeft: { transform: [{ scaleX: -1 }, { rotate: '-20deg' }] },
  leafRight: { transform: [{ rotate: '-20deg' }] },
  button: { alignSelf: 'stretch' },
});
