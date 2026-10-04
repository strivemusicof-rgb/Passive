import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { C, R, S } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

// Only cosmetics are ever sold: coins, land and income can't be bought,
// because land income turns into ⭐ reward points that can be cashed out.
const ITEMS: { key: 'skins' | 'names' | 'frames' | 'flags'; icon: IconName }[] = [
  { key: 'skins', icon: 'color-palette' },
  { key: 'names', icon: 'text' },
  { key: 'frames', icon: 'person-circle' },
  { key: 'flags', icon: 'flag' },
];

export default function ShopRoute() {
  const { t } = useTranslation();
  return (
    <Screen tabs>
      <View>
        <Text variant="h1">{t('shop.title')}</Text>
        <Text variant="small" color={C.textSecondary}>
          {t('shop.subtitle')}
        </Text>
      </View>

      <Card style={styles.fair}>
        <Ionicons name="shield-checkmark" size={24} color={C.green} />
        <Text variant="small" style={styles.flex}>
          {t('shop.fair')}
        </Text>
      </Card>

      {ITEMS.map((item) => (
        <Card key={item.key} style={styles.item}>
          <View style={styles.icon}>
            <Ionicons name={item.icon} size={22} color={C.gem} />
          </View>
          <View style={styles.flex}>
            <Text variant="bodyBold">{t(`shop.${item.key}`)}</Text>
            <Text variant="small" color={C.textSecondary}>
              {t(`shop.${item.key}Body`)}
            </Text>
          </View>
          <Text variant="tiny" color={C.textMuted}>
            {t('rewards.soon')}
          </Text>
        </Card>
      ))}

      <Button variant="outline" title={t('shop.earnStars')} onPress={() => router.push('/rewards')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  fair: { flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.md, borderColor: C.greenBorder },
  item: { flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.md },
  icon: { width: 40, height: 40, borderRadius: R.sm, backgroundColor: '#1F1A2B', alignItems: 'center', justifyContent: 'center' },
});
