import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { PlotThumb } from '@/components/plot-thumb';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Amount, CoinIcon, formatNumber } from '@/components/ui/currency';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { C, R, S } from '@/constants/theme';

// Prices are placeholders. Real ones come from App Store Connect (IAP phase).
const PACKS = [
  { coins: 1000, price: '€0.99' },
  { coins: 6000, price: '€4.99' },
  { coins: 13000, price: '€9.99' },
  { coins: 30000, price: '€19.99' },
];

/** Shop (not in the mockup; same style). Purchases are disabled until the IAP phase. */
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

      <Card style={[styles.starter]}>
        <PlotThumb kind="house" size={72} />
        <View style={styles.flex}>
          <Text variant="h3">{t('shop.starter')}</Text>
          <Text variant="small" color={C.textSecondary}>
            {t('shop.starterBody')}
          </Text>
        </View>
        <Button title="€0.99" size="sm" disabled />
      </Card>

      <Text variant="h3">{t('shop.coins')}</Text>
      <View style={styles.grid}>
        {PACKS.map((p) => (
          <Card key={p.coins} style={styles.pack}>
            <CoinIcon size={40} />
            <Text variant="h3">{formatNumber(p.coins)}</Text>
            <Button title={p.price} size="sm" disabled style={styles.stretch} />
          </Card>
        ))}
      </View>

      <Text variant="h3">{t('shop.boosts')}</Text>
      <Card style={styles.item}>
        <View style={styles.boostIcon}>
          <Ionicons name="flash" size={22} color={C.coin} />
        </View>
        <Text variant="bodyBold" style={styles.flex}>
          {t('shop.boost2x')}
        </Text>
        <Amount value={20} icon="gem" variant="smallBold" />
      </Card>
      <Card style={styles.item}>
        <View style={styles.boostIcon}>
          <Ionicons name="ticket" size={22} color={C.gem} />
        </View>
        <View style={styles.flex}>
          <Text variant="bodyBold">{t('shop.ticket')}</Text>
          <Text variant="small" color={C.textSecondary}>
            {t('shop.ticketBody')}
          </Text>
        </View>
        <Amount value={100} icon="gem" variant="smallBold" />
      </Card>
      <Text variant="tiny" color={C.textMuted} center>
        {t('shop.comingSoon')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  starter: { flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.md, borderColor: C.greenBorder },
  flex: { flex: 1, gap: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.md },
  pack: { width: '47%', flexGrow: 1, alignItems: 'center', padding: S.md, gap: S.sm },
  stretch: { alignSelf: 'stretch' },
  item: { flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.md },
  boostIcon: { width: 40, height: 40, borderRadius: R.sm, backgroundColor: '#1A1F1C', alignItems: 'center', justifyContent: 'center' },
});
