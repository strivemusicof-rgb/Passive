import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { PlotThumb } from '@/components/plot-thumb';
import { Card } from '@/components/ui/card';
import { Amount, CoinIcon, formatNumber } from '@/components/ui/currency';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { C, R, S } from '@/constants/theme';
import { buildingCatalogue } from '@/mock/data';

/** 9. Buildings catalogue (upgrade path for the selected plot). */
export default function BuildRoute() {
  const { t } = useTranslation();
  const currentIndex = 0;

  return (
    <Screen tabs>
      <View>
        <Text variant="h1">{t('build.title')}</Text>
        <Text variant="small" color={C.textSecondary}>
          {t('build.subtitle')}
        </Text>
      </View>
      {buildingCatalogue.map((b, i) => (
        <Card key={b.kind} style={[styles.row, i === currentIndex && styles.current]}>
          <PlotThumb kind={b.kind} size={64} />
          <View style={styles.info}>
            <Text variant="bodyBold">{t(`building.${b.kind}`)}</Text>
            <Amount value={`+${b.incomePerDay}`} suffix={t('common.perDay')} variant="small" iconSize={14} />
          </View>
          {i === currentIndex ? (
            <View style={styles.currentTag}>
              <Ionicons name="checkmark" size={18} color={C.green} />
              <Text variant="small" color={C.green}>
                {t('common.current')}
              </Text>
            </View>
          ) : (
            <View style={styles.cost}>
              <CoinIcon size={14} />
              <Text variant="smallBold">{formatNumber(b.cost)}</Text>
            </View>
          )}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: S.sm, gap: S.md },
  current: { borderColor: C.greenBorder },
  info: { flex: 1, gap: 4 },
  currentTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: S.sm },
  cost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: R.sm,
    backgroundColor: '#1A1F1C',
    borderWidth: 1,
    borderColor: '#3A3324',
  },
});
