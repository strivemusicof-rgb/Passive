import { Ionicons } from '@expo/vector-icons';
import type { AdPlacement } from '@landrush/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Button } from '@/components/ui/button';
import { formatNumber } from '@/components/ui/currency';
import { Text } from '@/components/ui/text';
import { C, S } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/error-message';
import { game, useGame } from '@/lib/game';
import { useNow } from '@/lib/use-now';

/**
 * "Watch ad" button for a rewarded video. Hidden when there's nothing to
 * offer (ads off, or no collect to double).
 */
export function AdButton({ placement, style }: { placement: AdPlacement; style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { ads, rewards } = useGame();
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  if (!ads?.enabled || !user) return null;
  if (placement === 'collect2x' && !ads.collect2x && !message) return null;

  const waitS = ads.cooldownUntil ? Math.ceil((new Date(ads.cooldownUntil).getTime() - now) / 1000) : 0;
  const noneLeft = ads.remainingToday <= 0;

  const title =
    placement === 'collect2x'
      ? t('ads.double', { coins: formatNumber(ads.collect2x?.coins ?? 0) })
      : rewards?.enabled
        ? t('ads.bonus', { coins: ads.bonus.coins, points: ads.bonus.points })
        : t('ads.bonusNoPoints', { coins: ads.bonus.coins });

  const watch = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const out = await game.watchAd(placement, user.id);
      const res = out.reward;
      if (!res) {
        const why = 'closed' in out && out.closed ? t('ads.closed') : t('ads.unavailable');
        const reason = 'reason' in out && out.reason ? ` (${out.reason})` : '';
        setMessage({ text: `${why}${reason}`, error: true });
      } else if (res.status === 'pending') setMessage({ text: t('ads.pending') });
      else
        setMessage({
          text:
            res.points > 0
              ? t('ads.gotPoints', { coins: formatNumber(res.coins), points: res.points })
              : t('ads.got', { coins: formatNumber(res.coins) }),
        });
    } catch (e) {
      setMessage({ text: errorMessage(t, e), error: true });
    } finally {
      setBusy(false);
      setTimeout(() => setMessage(null), 6000);
    }
  };

  const hint = noneLeft
    ? t('ads.none')
    : waitS > 0
      ? t('ads.wait', { s: waitS })
      : placement === 'bonus'
        ? t('ads.left', { n: ads.remainingToday })
        : null;

  return (
    <View style={[styles.wrap, style]}>
      {(placement === 'bonus' || ads.collect2x) && (
        <Button
          title={title}
          variant="blue"
          icon={<Ionicons name="play-circle" size={18} color={C.text} />}
          onPress={watch}
          disabled={busy || noneLeft || waitS > 0}
        />
      )}
      {message ? (
        <Text variant="small" color={message.error ? C.danger : C.coin} center>
          {message.text}
        </Text>
      ) : (
        hint && (
          <Text variant="tiny" color={C.textSecondary} center>
            {hint}
          </Text>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: S.xs },
});
