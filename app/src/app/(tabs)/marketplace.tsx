import { Ionicons } from '@expo/vector-icons';
import type { ListingDto, MarketSort } from '@landrush/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BUILDING_BY_LEVEL } from '@/components/art/plot-art';
import { PlotThumb } from '@/components/plot-thumb';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Amount, formatNumber } from '@/components/ui/currency';
import { RarityBadge } from '@/components/ui/rarity-badge';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { C, R, S } from '@/constants/theme';
import { api } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import { errorMessage } from '@/lib/error-message';
import { game, useGame } from '@/lib/game';

type Tab = 'sale' | 'favourites' | 'mine';
const SORTS: MarketSort[] = ['newest', 'cheapest', 'income', 'rarity'];
const SORT_LABEL = { newest: 'sortNewest', cheapest: 'sortCheapest', income: 'sortIncome', rarity: 'sortRarity' } as const;

/** 7. Marketplace: plots other players are selling. */
export default function MarketplaceRoute() {
  const { t } = useTranslation();
  const { wallet } = useGame();
  const [tab, setTab] = useState<Tab>('sale');
  const [sort, setSort] = useState<MarketSort>('newest');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<ListingDto[] | null>(null);
  const [history, setHistory] = useState<ListingDto[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [reload, setReload] = useState(0);

  // Reload when the screen comes back into view (e.g. after listing a plot).
  useFocusEffect(useCallback(() => setReload((n) => n + 1), []));

  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(
      () => {
        const load =
          tab === 'mine'
            ? api.myMarket().then((r) => {
                if (cancelled) return;
                setItems(r.active);
                setHistory(r.history);
              })
            : api.market({ sort, q: query.trim() || undefined, favourites: tab === 'favourites' }).then((r) => {
                if (!cancelled) setItems(r.listings);
              });
        load.catch((e) => !cancelled && setMessage({ text: errorMessage(t, e), error: true }));
      },
      query ? 300 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [tab, sort, query, reload, t]);

  const show = (text: string, error?: boolean) => {
    setMessage({ text, error });
    setTimeout(() => setMessage(null), 3000);
  };

  const buy = async (l: ListingDto) => {
    const ok = await confirm(
      t('market.confirmTitle', { id: l.plot.number }),
      t('market.confirmBody', { price: formatNumber(l.price) }),
      t('common.buy'),
      t('account.cancel'),
    );
    if (!ok) return;
    setBusy(l.id);
    try {
      const plot = await game.buyListing(l.id);
      show(t('market.bought', { id: plot.number }));
      setItems((prev) => prev?.filter((x) => x.id !== l.id) ?? null);
      router.push(`/plot/${plot.key}`);
    } catch (e) {
      show(errorMessage(t, e), true);
      setReload((n) => n + 1);
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (l: ListingDto) => {
    setBusy(l.id);
    try {
      await game.cancelListing(l.id);
      show(t('sell.cancelled'));
      setItems((prev) => prev?.filter((x) => x.id !== l.id) ?? null);
    } catch (e) {
      show(errorMessage(t, e), true);
    } finally {
      setBusy(null);
    }
  };

  const toggleFav = async (l: ListingDto) => {
    const on = !l.favourite;
    setItems((prev) => prev?.map((x) => (x.id === l.id ? { ...x, favourite: on } : x)) ?? null);
    try {
      await api.favourite(l.plot.key, on);
      if (!on && tab === 'favourites') setItems((prev) => prev?.filter((x) => x.id !== l.id) ?? null);
    } catch {
      setItems((prev) => prev?.map((x) => (x.id === l.id ? { ...x, favourite: !on } : x)) ?? null);
    }
  };

  const empty = tab === 'mine' ? t('market.emptyMine') : tab === 'favourites' ? t('market.emptyFavourites') : t('market.empty');

  return (
    <Screen tabs>
      <Text variant="h1">{t('market.title')}</Text>
      <Segmented
        options={[
          { value: 'sale', label: t('market.forSale') },
          { value: 'favourites', label: t('market.favourites') },
          { value: 'mine', label: t('market.myListings') },
        ]}
        value={tab}
        onChange={(v) => {
          setItems(null);
          setTab(v);
        }}
      />
      {tab !== 'mine' && (
        <>
          <View style={styles.search}>
            <Ionicons name="search" size={16} color={C.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('market.search')}
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.searchInput}
            />
          </View>
          <Segmented
            variant="bar"
            options={SORTS.map((s) => ({ value: s, label: t(`market.${SORT_LABEL[s]}`) }))}
            value={sort}
            onChange={setSort}
          />
        </>
      )}

      {message && (
        <Text variant="smallBold" color={message.error ? C.danger : C.green} center>
          {message.text}
        </Text>
      )}

      {!items ? (
        <ActivityIndicator color={C.green} />
      ) : items.length === 0 ? (
        <Text color={C.textSecondary} center style={styles.empty}>
          {empty}
        </Text>
      ) : (
        items.map((l) => (
          <Pressable key={l.id} onPress={() => router.push(`/plot/${l.plot.key}`)}>
            <Card style={styles.row}>
              <PlotThumb kind={BUILDING_BY_LEVEL[l.plot.buildingLevel] ?? 'empty'} />
              <View style={styles.info}>
                <Text variant="bodyBold">#{l.plot.number}</Text>
                <Text variant="small" color={l.mine ? C.textSecondary : (l.seller.style.nameColor ?? C.textSecondary)} numberOfLines={1}>
                  {l.mine ? t('market.yours') : t('market.seller', { name: l.seller.displayName })}
                </Text>
                <Amount value={l.plot.incomePerDay} suffix={t('common.perDay')} variant="smallBold" iconSize={14} />
              </View>
              <View style={styles.right}>
                <View style={styles.badgeRow}>
                  <RarityBadge rarity={l.plot.rarity} />
                  {!l.mine && (
                    <Pressable hitSlop={10} onPress={() => toggleFav(l)} accessibilityLabel={t('market.favourites')}>
                      <Ionicons
                        name={l.favourite ? 'heart' : 'heart-outline'}
                        size={18}
                        color={l.favourite ? C.green : C.textSecondary}
                      />
                    </Pressable>
                  )}
                </View>
                <Amount value={l.price} variant="bodyBold" />
                {l.mine ? (
                  <Button
                    title={t('market.cancel')}
                    size="sm"
                    variant="outline"
                    onPress={() => cancel(l)}
                    disabled={busy === l.id}
                  />
                ) : (
                  <Button
                    title={t('common.buy')}
                    size="sm"
                    style={styles.buy}
                    onPress={() => buy(l)}
                    disabled={busy === l.id || (wallet != null && wallet.coins < l.price)}
                  />
                )}
              </View>
            </Card>
          </Pressable>
        ))
      )}

      {tab === 'mine' && history.length > 0 && (
        <>
          <Text variant="h3">{t('market.history')}</Text>
          <Card>
            {history.map((h, i) => (
              <View key={h.id} style={[styles.historyRow, i < history.length - 1 && styles.border]}>
                <Text variant="smallBold">#{h.plot.number}</Text>
                <Text variant="small" color={C.textSecondary} style={styles.flex}>
                  {h.mine
                    ? t('market.sold', { price: formatNumber(h.price) })
                    : t('market.boughtFor', { price: formatNumber(h.price) })}
                </Text>
                <Text variant="tiny" color={C.textMuted}>
                  {h.closedAt ? new Date(h.closedAt).toLocaleDateString() : ''}
                </Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
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
  empty: { marginTop: S.lg },
  row: { flexDirection: 'row', alignItems: 'center', padding: S.sm, gap: S.md },
  info: { flex: 1, gap: 2 },
  right: { alignItems: 'flex-end', gap: 6 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  buy: { minWidth: 64 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingHorizontal: S.md, paddingVertical: 12 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.divider },
  flex: { flex: 1 },
});
