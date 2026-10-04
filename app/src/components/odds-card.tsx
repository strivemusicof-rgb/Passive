import { RARITIES, type Rarity } from '@landrush/shared';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { RarityBadge } from '@/components/ui/rarity-badge';
import { Text } from '@/components/ui/text';
import { C, RARITY_COLORS, S } from '@/constants/theme';

/** Shows the exact chance of each rarity before buying (App Store rule for random items). */
export function OddsCard({ odds }: { odds: Record<Rarity, number> }) {
  const { t } = useTranslation();
  return (
    <Card style={styles.card}>
      <Text variant="bodyBold">{t('plot.odds')}</Text>
      <Text variant="small" color={C.textSecondary}>
        {t('plot.oddsHint')}
      </Text>
      {RARITIES.map((r) => (
        <View key={r} style={styles.row}>
          <View style={styles.badge}>
            <RarityBadge rarity={r} />
          </View>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${Math.max(odds[r] * 100, 1)}%`, backgroundColor: RARITY_COLORS[r].map },
              ]}
            />
          </View>
          <Text variant="smallBold" style={styles.pct}>
            {formatPercent(odds[r])}
          </Text>
        </View>
      ))}
    </Card>
  );
}

function formatPercent(p: number) {
  const pct = p * 100;
  return `${pct >= 10 ? pct.toFixed(0) : pct.toFixed(1)}%`;
}

const styles = StyleSheet.create({
  card: { padding: S.lg, gap: S.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  badge: { width: 84 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#25302B', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  pct: { width: 48, textAlign: 'right' },
});
