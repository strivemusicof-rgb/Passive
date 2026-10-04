import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PlotThumb } from '@/components/plot-thumb';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Amount } from '@/components/ui/currency';
import { RarityBadge } from '@/components/ui/rarity-badge';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { C, R, S } from '@/constants/theme';
import { listings } from '@/mock/data';

/** 7. Marketplace. */
export default function MarketplaceRoute() {
  const { t } = useTranslation();
  const [kind, setKind] = useState<'all' | 'land' | 'buildings'>('land');
  const [view, setView] = useState<'map' | 'list'>('list');
  const [query, setQuery] = useState('');
  const [favs, setFavs] = useState<Set<number>>(new Set([5012]));

  const q = query.trim().toLowerCase();
  const items = listings.filter(
    (l) =>
      (kind !== 'buildings' || l.building !== 'empty') &&
      (!q || l.city.toLowerCase().includes(q) || String(l.id).includes(q) || l.seller.toLowerCase().includes(q)),
  );

  const toggleFav = (id: number) =>
    setFavs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Screen tabs>
      <Text variant="h1">{t('market.title')}</Text>
      <View style={styles.searchRow}>
        <View style={styles.search}>
          <Ionicons name="search" size={16} color={C.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('market.search')}
            placeholderTextColor={C.textMuted}
            style={styles.searchInput}
          />
        </View>
        <Pressable style={styles.filter}>
          <Ionicons name="funnel-outline" size={18} color={C.text} />
        </Pressable>
      </View>
      <Segmented
        options={[
          { value: 'all', label: t('market.all') },
          { value: 'land', label: t('market.landPlots') },
          { value: 'buildings', label: t('market.buildings') },
        ]}
        value={kind}
        onChange={setKind}
      />
      {items.map((l) => (
        <Pressable key={l.id} onPress={() => router.push(`/plot/${l.id}`)}>
          <Card style={styles.row}>
            <PlotThumb kind={l.building} />
            <View style={styles.info}>
              <Text variant="bodyBold">#{l.id}</Text>
              <Text variant="small" color={C.textSecondary}>
                {l.city}
              </Text>
              <Amount value={l.incomePerDay} suffix={t('common.perDay')} variant="smallBold" iconSize={14} />
            </View>
            <View style={styles.right}>
              <View style={styles.badgeRow}>
                <RarityBadge rarity={l.rarity} />
                <Pressable hitSlop={10} onPress={() => toggleFav(l.id)}>
                  <Ionicons name={favs.has(l.id) ? 'heart' : 'heart-outline'} size={18} color={favs.has(l.id) ? C.green : C.textSecondary} />
                </Pressable>
              </View>
              <Amount value={l.price} variant="bodyBold" />
              <Button title={t('common.buy')} size="sm" style={styles.buy} />
            </View>
          </Card>
        </Pressable>
      ))}
      <View style={styles.viewToggle}>
        <Segmented
          variant="bar"
          options={[
            { value: 'map', label: t('market.mapView') },
            { value: 'list', label: t('market.listView') },
          ]}
          value={view}
          onChange={setView}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', gap: S.sm },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    height: 40,
    paddingHorizontal: S.md,
    borderRadius: R.sm,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  searchInput: { flex: 1, color: C.text, fontSize: 13 },
  filter: { width: 40, height: 40, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.cardBorder },
  row: { flexDirection: 'row', alignItems: 'center', padding: S.sm, gap: S.md },
  info: { flex: 1, gap: 2 },
  right: { alignItems: 'flex-end', gap: 6 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  buy: { minWidth: 64 },
  viewToggle: { marginTop: S.xs },
});
