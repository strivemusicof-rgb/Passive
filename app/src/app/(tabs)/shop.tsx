import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { CosmeticItemDto, CosmeticsResponse } from '@landrush/shared';
import type { CosmeticType } from '@landrush/shared/cosmetics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CoinIcon, formatNumber, GemIcon } from '@/components/ui/currency';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { C, R, S } from '@/constants/theme';
import { api } from '@/lib/api';
import { auth, useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/error-message';
import { game, useGame } from '@/lib/game';

const TABS: { type: CosmeticType; label: 'tabSkins' | 'tabFlags' | 'tabNames' | 'tabFrames' }[] = [
  { type: 'plotSkin', label: 'tabSkins' },
  { type: 'plotFlag', label: 'tabFlags' },
  { type: 'nameColor', label: 'tabNames' },
  { type: 'avatarFrame', label: 'tabFrames' },
];

/**
 * Cosmetics shop. Only looks are sold, for gems or coins earned in the game:
 * coins, land and income can't be bought, because land income turns into ⭐
 * reward points that can be cashed out.
 */
export default function ShopRoute() {
  const { t } = useTranslation();
  const { wallet } = useGame();
  const [type, setType] = useState<CosmeticType>('plotSkin');
  const [data, setData] = useState<CosmeticsResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  useFocusEffect(
    useCallback(() => {
      api.cosmetics().then(setData).catch(() => {});
    }, []),
  );

  const show = (text: string, error?: boolean) => {
    setMessage({ text, error });
    setTimeout(() => setMessage(null), 3000);
  };

  const buy = async (item: CosmeticItemDto) => {
    setBusy(item.id);
    try {
      const res = await api.buyCosmetic(item.id);
      game.setWallet(res.wallet);
      setData(res);
      show(t('shop.bought'));
    } catch (e) {
      show(errorMessage(t, e), true);
    } finally {
      setBusy(null);
    }
  };

  /** Name colours and frames: wear it, or take it off (id null). */
  const equip = async (item: CosmeticItemDto, on: boolean) => {
    setBusy(item.id);
    const key = item.type === 'nameColor' ? 'nameColor' : 'avatarFrame';
    try {
      const user = await api.setStyle({ [key]: on ? item.id : null });
      auth.setUser(user);
      setData((d) => (d ? { ...d, equipped: { ...d.equipped, [key]: on ? item.id : null } } : d));
    } catch (e) {
      show(errorMessage(t, e), true);
    } finally {
      setBusy(null);
    }
  };

  const items = data?.items.filter((i) => i.type === type) ?? [];

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

      <Segmented options={TABS.map((x) => ({ value: x.type, label: t(`shop.${x.label}`) }))} value={type} onChange={setType} />

      {message && (
        <Text variant="smallBold" color={message.error ? C.danger : C.green} center>
          {message.text}
        </Text>
      )}

      {!data ? (
        <ActivityIndicator color={C.green} />
      ) : (
        <View style={styles.grid}>
          {items.map((item) => {
            const equipped = data.equipped.nameColor === item.id || data.equipped.avatarFrame === item.id;
            const wearable = item.type === 'nameColor' || item.type === 'avatarFrame';
            const price = item.gems ?? item.coins ?? 0;
            const canAfford = item.gems ? (wallet?.gems ?? 0) >= item.gems : (wallet?.coins ?? 0) >= (item.coins ?? 0);
            return (
              <Card key={item.id} style={[styles.item, equipped && styles.equipped]}>
                <Preview item={item} />
                {!item.owned ? (
                  <Button
                    title={formatNumber(price)}
                    size="sm"
                    icon={item.gems ? <GemIcon size={14} /> : <CoinIcon size={14} />}
                    onPress={() => buy(item)}
                    disabled={busy === item.id || !canAfford}
                  />
                ) : wearable ? (
                  <Button
                    title={equipped ? t('shop.takeOff') : t('shop.use')}
                    size="sm"
                    variant={equipped ? 'outline' : 'blue'}
                    onPress={() => equip(item, !equipped)}
                    disabled={busy === item.id}
                  />
                ) : (
                  <View style={styles.owned}>
                    <Ionicons name="checkmark-circle" size={16} color={C.green} />
                    <Text variant="tiny" color={C.green}>
                      {t('shop.owned')}
                    </Text>
                  </View>
                )}
              </Card>
            );
          })}
        </View>
      )}
      {(type === 'plotSkin' || type === 'plotFlag') && (
        <Text variant="tiny" color={C.textMuted} center>
          {t('shop.usePlot')}
        </Text>
      )}

      <Button variant="outline" title={t('shop.earnStars')} onPress={() => router.push('/rewards')} />
    </Screen>
  );
}

/** What the item looks like: a tile, a flag, a coloured name or a framed avatar. */
function Preview({ item }: { item: CosmeticItemDto }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const name = user?.displayName ?? t('shop.preview');
  switch (item.type) {
    case 'plotSkin':
      return (
        <View style={[styles.tile, { borderColor: item.value, backgroundColor: `${item.value}55`, shadowColor: item.value }]}>
          <MaterialCommunityIcons name="home-variant" size={30} color="rgba(255,255,255,0.92)" />
        </View>
      );
    case 'plotFlag':
      return (
        <View style={[styles.tile, styles.flagTile]}>
          <Text style={styles.flag}>{item.value}</Text>
        </View>
      );
    case 'nameColor':
      return (
        <View style={styles.namePreview}>
          <Text variant="bodyBold" color={item.value} numberOfLines={1}>
            {name}
          </Text>
        </View>
      );
    case 'avatarFrame':
      return (
        <View style={styles.namePreview}>
          <Avatar name={name} size={54} frame={{ color: item.value, accent: item.accent }} />
        </View>
      );
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  fair: { flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.md, borderColor: C.greenBorder },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.md },
  item: { width: '47%', flexGrow: 1, alignItems: 'center', gap: S.md, padding: S.md },
  equipped: { borderColor: C.green },
  tile: {
    width: 72,
    height: 72,
    borderRadius: R.md,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.8,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  flagTile: { borderColor: '#3A4843', backgroundColor: '#0B1310' },
  flag: { fontSize: 40, lineHeight: 48 },
  namePreview: { height: 72, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  owned: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30 },
});
