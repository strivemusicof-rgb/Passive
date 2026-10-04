import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlotArt, type BuildingKind } from '@/components/art/plot-art';
import { TutorialGrid } from '@/components/art/tutorial-grid';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { C, S } from '@/constants/theme';
import { ApiError } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import { game } from '@/lib/game';
import { currentPosition, DEFAULT_POSITION } from '@/lib/location';

const STEPS: { key: 's1' | 's2' | 's3' | 's4'; art?: BuildingKind }[] = [
  { key: 's1' },
  { key: 's2', art: 'house' },
  { key: 's3', art: 'office' },
  { key: 's4', art: 'tower' },
];

/** 3. Tutorial: claim starter plot → collect → build → trade. */
export default function TutorialRoute() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = STEPS[step];
  const finish = () => router.replace('/map');

  /** Skipping still hands out the free starter plot. */
  const skip = async () => {
    if (claiming) return;
    if (step === 0 && claimed == null) {
      setClaiming(true);
      const pos = (await currentPosition()) ?? DEFAULT_POSITION;
      await game.claimStarter(pos.lat, pos.lng).catch(() => {});
    }
    finish();
  };

  /** Step 1: the free starter plot, as close to the player as possible. */
  const claim = async () => {
    setClaiming(true);
    setError(null);
    try {
      const pos = (await currentPosition()) ?? DEFAULT_POSITION;
      const plot = await game.claimStarter(pos.lat, pos.lng);
      setClaimed(plot.number);
      setStep(1);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'starter_already_claimed') setStep(1);
      else setError(errorMessage(t, e));
    } finally {
      setClaiming(false);
    }
  };

  const next = () => {
    if (claiming) return;
    if (step === 0) return claim();
    if (step === STEPS.length - 1) return finish();
    setStep(step + 1);
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.top}>
        <Text variant="smallBold" color={C.green} center>
          {t('tutorial.step', { step: step + 1, total: STEPS.length })}
        </Text>
        <Text variant="h2" center>
          {t(`tutorial.${current.key}Title`)}
        </Text>
        <Text color="#DCE4E0" center style={styles.body}>
          {t(`tutorial.${current.key}Body`)}
        </Text>
        <Pressable onPress={skip} hitSlop={12} style={styles.skip}>
          <Text variant="small" color={C.textSecondary}>
            {t('common.skip')}
          </Text>
        </Pressable>
      </View>

      <Pressable style={styles.art} onPress={next}>
        {current.art ? (
          <PlotArt kind={current.art} size={260} glow />
        ) : (
          <View>
            <TutorialGrid width={360} />
            <Ionicons name="hand-left" size={64} color="#FFFFFF" style={styles.hand} />
          </View>
        )}
      </Pressable>

      <View style={styles.footer}>
        {claimed != null && step === 1 && (
          <Text variant="bodyBold" color={C.green} center>
            {t('tutorial.claimed', { number: claimed })}
          </Text>
        )}
        {error && (
          <Text variant="small" color={C.danger} center>
            {error}
          </Text>
        )}
        {claiming && <ActivityIndicator color={C.green} />}
        <Button
          title={step === 0 ? t('tutorial.claim') : t('common.continue')}
          onPress={next}
          disabled={claiming}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0C1311' },
  top: { paddingHorizontal: S.xxl, paddingTop: S.lg, gap: S.sm },
  skip: { position: 'absolute', right: S.xl, top: S.sm },
  body: { lineHeight: 22 },
  art: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hand: { position: 'absolute', left: '47%', top: '52%', transform: [{ rotate: '-20deg' }] },
  footer: { paddingHorizontal: S.xl, paddingBottom: S.md, gap: S.md },
});
