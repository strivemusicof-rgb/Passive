import type { Rarity } from '@landrush/shared';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { RARITY_COLORS, R } from '@/constants/theme';

import { Text } from './text';

export function RarityBadge({ rarity, size = 'sm' }: { rarity: Rarity; size?: 'sm' | 'md' }) {
  const { t } = useTranslation();
  const colors = RARITY_COLORS[rarity];
  return (
    <View style={[styles.badge, size === 'md' && styles.md, { backgroundColor: colors.bg }]}>
      <Text variant={size === 'md' ? 'smallBold' : 'tiny'} color={colors.text}>
        {t(`rarity.${rarity}`)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: R.sm - 3, alignSelf: 'flex-start' },
  md: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.sm },
});
