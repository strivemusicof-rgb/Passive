import { Ionicons } from '@expo/vector-icons';
import type { MissionDto } from '@landrush/shared';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { DailyStreak } from '@/components/daily-streak';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Amount } from '@/components/ui/currency';
import { Progress } from '@/components/ui/progress';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { C, S } from '@/constants/theme';
import { errorMessage } from '@/lib/error-message';
import { game, useGame } from '@/lib/game';

type IconName = keyof typeof Ionicons.glyphMap;

/** Icon and where "Go" takes the player, by mission key. */
const MISSION_UI: Record<string, { icon: IconName; go: Href }> = {
  login: { icon: 'calendar-outline', go: '/missions' },
  collect: { icon: 'cash-outline', go: '/map' },
  collect10: { icon: 'cash-outline', go: '/map' },
  buyPlot: { icon: 'cart-outline', go: '/map' },
  buyPlot3: { icon: 'cart-outline', go: '/map' },
  upgrade: { icon: 'arrow-up-circle-outline', go: '/build' },
  upgrade3: { icon: 'arrow-up-circle-outline', go: '/build' },
  checkIn: { icon: 'walk-outline', go: '/lands' },
  checkIn5: { icon: 'walk-outline', go: '/lands' },
};

/** 10. Missions (daily + weekly) and the 7-day login streak. */
export default function MissionsRoute() {
  const { t } = useTranslation();
  const { missions, daily } = useGame();
  const [tab, setTab] = useState<'daily' | 'weekly'>('daily');
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const list = missions ? missions[tab] : null;

  const flash = (text: string, error = false) => {
    setMessage({ text, error });
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <Screen tabs>
      <Text variant="h1">{t('missions.title')}</Text>
      {daily && <DailyStreak daily={daily} onClaimed={(text) => flash(text)} />}
      {message && (
        <Text variant="bodyBold" color={message.error ? C.danger : C.coin} center>
          {message.text}
        </Text>
      )}
      <Segmented
        variant="bar"
        options={[
          { value: 'daily', label: t('missions.daily') },
          { value: 'weekly', label: t('missions.weekly') },
        ]}
        value={tab}
        onChange={setTab}
      />
      {missions && (
        <Text variant="tiny" color={C.textMuted} center>
          {t('missions.resets', {
            time: resetText(tab === 'daily' ? missions.dailyResetsAt : missions.weeklyResetsAt, t),
          })}
        </Text>
      )}
      {!list && <ActivityIndicator color={C.green} />}
      {list?.map((m) => (
        <MissionRow key={m.key} mission={m} scope={tab} onDone={flash} />
      ))}
    </Screen>
  );
}

function MissionRow({
  mission: m,
  scope,
  onDone,
}: {
  mission: MissionDto;
  scope: 'daily' | 'weekly';
  onDone: (text: string, error?: boolean) => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const ui = MISSION_UI[m.key] ?? { icon: 'star-outline', go: '/map' };
  const complete = m.progress >= m.target;

  const claim = async () => {
    setBusy(true);
    try {
      const res = await game.claimMission(scope, m.key);
      onDone(
        `+${res.coins} 🪙${res.gems ? `  +${res.gems} 💎` : ''}  +${res.xp} XP${res.leveledUp ? `  ·  ${t('progress.levelUp', { level: res.user.level })}` : ''}`,
      );
    } catch (e) {
      onDone(errorMessage(t, e), true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={[styles.row, m.claimed && styles.claimed]}>
      <View style={[styles.icon, complete && styles.iconDone]}>
        <Ionicons name={ui.icon} size={22} color={complete ? '#06200D' : C.green} />
      </View>
      <View style={styles.info}>
        <Text variant="bodyBold">{t(`missions.${m.key}`)}</Text>
        <View style={styles.progressRow}>
          <Text variant="small" color={C.textSecondary}>
            {m.progress}/{m.target}
          </Text>
          <Progress value={m.progress / m.target} height={4} style={styles.bar} />
          <Amount value={m.coins} variant="smallBold" iconSize={14} />
          {m.gems > 0 && <Amount value={m.gems} icon="gem" variant="smallBold" iconSize={13} />}
        </View>
      </View>
      {m.claimed ? (
        <View style={styles.done}>
          <Ionicons name="checkmark" size={20} color="#06200D" />
        </View>
      ) : complete ? (
        <Button title={t('missions.claim')} size="sm" onPress={claim} disabled={busy} />
      ) : (
        <Button
          title={t('common.go')}
          size="sm"
          variant="blue"
          style={styles.go}
          onPress={() => router.navigate(ui.go)}
        />
      )}
    </Card>
  );
}

function resetText(iso: string, t: TFunction) {
  const ms = new Date(iso).getTime() - Date.now();
  const h = Math.max(0, Math.floor(ms / 3_600_000));
  return h >= 24
    ? t('missions.days', { count: Math.floor(h / 24) })
    : t('missions.hours', { count: Math.max(1, h) });
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: S.md, gap: S.md },
  claimed: { opacity: 0.6 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDone: { backgroundColor: C.green },
  info: { flex: 1, gap: 6 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  bar: { flex: 1 },
  go: { minWidth: 48 },
  done: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
