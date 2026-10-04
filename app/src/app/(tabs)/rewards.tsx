import { Ionicons } from '@expo/vector-icons';
import type { RewardsDto } from '@landrush/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AdButton } from '@/components/ad-button';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatNumber, PointsIcon } from '@/components/ui/currency';
import { Header } from '@/components/ui/header';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { C, R, S } from '@/constants/theme';
import { errorMessage } from '@/lib/error-message';
import { game, useGame } from '@/lib/game';

type IconName = keyof typeof Ionicons.glyphMap;

const euro = (points: number, perEuro: number) => `€${(points / perEuro).toFixed(2)}`;

/** ⭐ reward points: balance, how to earn, cash-out to PayPal or a gift card. */
export default function RewardsRoute() {
  const { t } = useTranslation();
  const { rewards } = useGame();

  useEffect(() => {
    game.loadRewards().catch(() => {});
  }, []);

  return (
    <Screen tabs>
      <Header title={t('rewards.title')} />
      {!rewards ? <ActivityIndicator color={C.green} /> : <RewardsBody r={rewards} />}
    </Screen>
  );
}

function RewardsBody({ r }: { r: RewardsDto }) {
  const { t } = useTranslation();
  const earnRows: { icon: IconName; text: string; value: string }[] = [
    {
      icon: 'cash-outline',
      text: t('rewards.earnLand', { coins: r.earn.landCoinsPerPoint }),
      value: t('rewards.upTo', { n: r.earn.landDailyCap }),
    },
    { icon: 'walk-outline', text: t('rewards.earnCheckIn'), value: `+${r.earn.checkIn}` },
    { icon: 'calendar-outline', text: t('rewards.earnStreak'), value: `+${r.earn.streakDay7}` },
    { icon: 'trophy-outline', text: t('rewards.earnWeekly'), value: `+${r.earn.weeklyMission}` },
    { icon: 'trending-up-outline', text: t('rewards.earnLevel'), value: `+${r.earn.levelUp}` },
    ...(r.earn.adsPerDay > 0
      ? [{ icon: 'play-circle-outline' as IconName, text: t('rewards.earnAds', { n: r.earn.adsPerDay }), value: `+${r.earn.perAd}` }]
      : []),
    { icon: 'gift-outline', text: t('rewards.earnOffers'), value: t('rewards.soon') },
  ];

  return (
    <>
      {/* Balance */}
      <Card style={styles.balance}>
        <View style={styles.balanceRow}>
          <PointsIcon size={36} />
          <Text style={styles.big}>{formatNumber(r.points)}</Text>
        </View>
        <Text color={C.textSecondary} center>
          ≈ {euro(r.points, r.pointsPerEuro)} ·{' '}
          {t('rewards.rate', { points: formatNumber(r.pointsPerEuro) })}
        </Text>
        <Progress value={r.points / r.minCashoutPoints} height={8} color={C.coin} />
        <Text variant="small" color={C.textSecondary} center>
          {r.points >= r.minCashoutPoints
            ? t('rewards.canCashOut')
            : t('rewards.toMinimum', {
                points: formatNumber(r.minCashoutPoints - r.points),
                min: euro(r.minCashoutPoints, r.pointsPerEuro),
              })}
        </Text>
      </Card>

      {!r.enabled && (
        <Card style={styles.notice}>
          <Ionicons name="time-outline" size={20} color={C.coin} />
          <Text variant="small" style={styles.flex}>
            {t('rewards.comingSoon')}
          </Text>
        </Card>
      )}

      {/* Today */}
      <Card style={styles.section}>
        <View style={styles.between}>
          <Text variant="bodyBold">{t('rewards.today')}</Text>
          <Text variant="smallBold" color={C.coin}>
            {Math.min(r.todayEarned, r.dailyCap)}/{r.dailyCap} ⭐
          </Text>
        </View>
        <Progress value={r.todayEarned / r.dailyCap} height={6} color={C.coin} />
        <Text variant="tiny" color={C.textSecondary}>
          {t('rewards.todayLand', { n: Math.min(r.todayLand, r.earn.landDailyCap), max: r.earn.landDailyCap })}
        </Text>
        {r.nextLevelDailyCap && (
          <Text variant="tiny" color={C.textSecondary}>
            {t('rewards.nextLevelCap', { n: r.nextLevelDailyCap })}
          </Text>
        )}
      </Card>

      {/* Rewarded video: ⭐ on top of the free-play limit */}
      <Card style={styles.section}>
        <Text variant="bodyBold">{t('ads.title')}</Text>
        <AdButton placement="bonus" />
      </Card>

      {/* How to earn */}
      <Text variant="h3">{t('rewards.howToEarn')}</Text>
      <Card>
        {earnRows.map((row, i) => (
          <View key={row.text} style={[styles.earnRow, i < earnRows.length - 1 && styles.border]}>
            <Ionicons name={row.icon} size={20} color={C.green} />
            <Text variant="small" style={styles.flex}>
              {row.text}
            </Text>
            <Text variant="smallBold" color={C.coin}>
              {row.value}
            </Text>
          </View>
        ))}
      </Card>

      <CashOut r={r} />

      {r.requests.length > 0 && (
        <>
          <Text variant="h3">{t('rewards.requests')}</Text>
          {r.requests.map((q) => (
            <Card key={q.id} style={styles.request}>
              <View style={styles.flex}>
                <Text variant="bodyBold">
                  €{(q.eurCents / 100).toFixed(2)} ·{' '}
                  {t(`rewards.method.${q.method}`, { defaultValue: q.method })}
                </Text>
                <Text variant="tiny" color={C.textSecondary}>
                  {new Date(q.createdAt).toLocaleDateString()} · {q.destination}
                </Text>
                {q.note && (
                  <Text variant="tiny" color={C.danger}>
                    {q.note}
                  </Text>
                )}
              </View>
              <View style={[styles.status, styles[q.status]]}>
                <Text variant="tiny">{t(`rewards.status.${q.status}`)}</Text>
              </View>
            </Card>
          ))}
        </>
      )}

      {r.history.length > 0 && (
        <>
          <Text variant="h3">{t('rewards.history')}</Text>
          <Card>
            {r.history.map((h, i) => (
              <View key={i} style={[styles.earnRow, i < r.history.length - 1 && styles.border]}>
                <Text variant="small" style={styles.flex}>
                  {t(`rewards.type.${h.type}`, { defaultValue: h.type })}
                </Text>
                <Text variant="tiny" color={C.textMuted}>
                  {new Date(h.createdAt).toLocaleDateString()}
                </Text>
                <Text variant="smallBold" color={h.amount > 0 ? C.green : C.textSecondary}>
                  {h.amount > 0 ? '+' : ''}
                  {formatNumber(h.amount)}
                </Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </>
  );
}

function CashOut({ r }: { r: RewardsDto }) {
  const { t } = useTranslation();
  const [method, setMethod] = useState(r.methods[0] ?? 'paypal');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const amount = Math.floor(r.points / r.pointsPerEuro) * r.pointsPerEuro;
  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await game.cashout(method, email.trim());
      setMessage({ text: t('rewards.requested') });
      setEmail('');
    } catch (e) {
      setMessage({ text: errorMessage(t, e), error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={styles.section}>
      <Text variant="h3">{t('rewards.cashOut')}</Text>
      <Segmented
        variant="bar"
        options={r.methods.map((m) => ({
          value: m,
          label: t(`rewards.method.${m}`, { defaultValue: m }),
        }))}
        value={method}
        onChange={setMethod}
      />
      <Input
        label={method === 'paypal' ? t('rewards.paypalEmail') : t('rewards.giftEmail')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="name@example.com"
      />
      {r.cashoutBlocked && (
        <Text variant="small" color={C.textSecondary}>
          {t(`rewards.blocked.${r.cashoutBlocked}`, {
            min: euro(r.minCashoutPoints, r.pointsPerEuro),
          })}
        </Text>
      )}
      <Button
        title={t('rewards.cashOutButton', { amount: euro(amount, r.pointsPerEuro) })}
        onPress={submit}
        disabled={!!r.cashoutBlocked || !validEmail || busy}
      />
      {message && (
        <Text variant="small" color={message.error ? C.danger : C.green} center>
          {message.text}
        </Text>
      )}
      <Text variant="tiny" color={C.textMuted}>
        {t('rewards.fineprint')}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  balance: { padding: S.lg, gap: S.sm, borderColor: '#5A4A1A' },
  balanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm },
  big: { fontSize: 40, fontWeight: '800', color: C.text },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    padding: S.md,
    borderColor: '#5A4A1A',
    backgroundColor: '#1F1A0B',
  },
  section: { padding: S.md, gap: S.sm },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  earnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    paddingHorizontal: S.md,
    paddingVertical: 12,
  },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.divider },
  request: { flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.md },
  status: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: R.pill },
  pending: { backgroundColor: '#3A2C0C' },
  approved: { backgroundColor: '#13305A' },
  paid: { backgroundColor: C.greenSoft },
  rejected: { backgroundColor: '#3A1517' },
});
