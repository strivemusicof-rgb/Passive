import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Header } from '@/components/ui/header';
import { Progress } from '@/components/ui/progress';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { C, S } from '@/constants/theme';
import { useGame } from '@/lib/game';

type IconName = keyof typeof Ionicons.glyphMap;

const ICONS: Record<string, IconName> = {
  firstPlot: 'flag',
  plots10: 'grid',
  plots50: 'apps',
  firstHouse: 'home',
  firstTower: 'business',
  rarePlot: 'diamond',
  legendaryPlot: 'star',
  level5: 'trending-up',
  level10: 'rocket',
  streak7: 'calendar',
  checkIns10: 'walk',
};

/** Achievements: unlocked ones in colour, others with progress. */
export default function BadgesRoute() {
  const { t } = useTranslation();
  const { achievements } = useGame();
  const unlocked = achievements?.filter((a) => a.unlocked).length ?? 0;

  return (
    <Screen tabs>
      <Header title={t('profile.badges')} subtitle={achievements ? t('badges.count', { done: unlocked, total: achievements.length }) : undefined} />
      {!achievements && <ActivityIndicator color={C.green} />}
      {achievements?.map((a) => (
        <Card key={a.key} style={[styles.row, !a.unlocked && styles.locked]}>
          <View style={[styles.icon, a.unlocked && styles.iconOn]}>
            <Ionicons name={ICONS[a.key] ?? 'ribbon'} size={22} color={a.unlocked ? '#1A1200' : C.textMuted} />
          </View>
          <View style={styles.info}>
            <Text variant="bodyBold">{t(`badges.${a.key}`)}</Text>
            {a.unlocked ? (
              <Text variant="small" color={C.green}>
                {t('badges.unlocked')}
              </Text>
            ) : (
              <View style={styles.progress}>
                <Progress value={a.progress / a.target} height={4} style={styles.bar} />
                <Text variant="tiny" color={C.textSecondary}>
                  {a.progress}/{a.target}
                </Text>
              </View>
            )}
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.md },
  locked: { opacity: 0.75 },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1F2824', alignItems: 'center', justifyContent: 'center' },
  iconOn: { backgroundColor: C.coin },
  info: { flex: 1, gap: 4 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  bar: { flex: 1 },
});
