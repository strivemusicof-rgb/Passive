import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameMap, type GameMapHandle } from '@/components/game-map';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Amount } from '@/components/ui/currency';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { C, R, S, TAB_BAR_HEIGHT } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { mapPlots, me } from '@/mock/data';

const RIGA = { lat: 56.9496, lng: 24.1052 };

type IconName = keyof typeof Ionicons.glyphMap;

/** 4. Home / map. */
export default function MapRoute() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const map = useRef<GameMapHandle>(null);
  const { user } = useAuth();

  return (
    <View style={styles.root}>
      <GameMap ref={map} plots={mapPlots} center={RIGA} onPlotPress={(id) => router.push(`/plot/${id}`)} />

      {/* Top bar: level, coins, gems */}
      <View style={[styles.topBar, { paddingTop: insets.top + S.xs }]}>
        <Pressable style={styles.level} onPress={() => router.push('/profile')}>
          <Avatar name={user?.displayName ?? me.name} size={38} ring={C.green} />
          <View style={styles.levelText}>
            <Text variant="smallBold">{t('common.lv', { level: user?.level ?? me.level })}</Text>
            <Progress value={me.xp / me.xpNext} height={4} />
          </View>
        </Pressable>
        <View style={styles.balances}>
          <Amount value={me.coins} variant="h3" iconSize={20} />
          <Amount value={me.gems} icon="gem" variant="h3" iconSize={18} />
          <Pressable style={styles.plus} onPress={() => router.push('/shop')}>
            <Ionicons name="add" size={16} color="#06200D" />
          </Pressable>
        </View>
      </View>

      {/* Income + collect */}
      <View style={[styles.collect, { top: insets.top + 64 }]}>
        <Text variant="h3" color={C.green} center>
          + {me.incomePerHour} {t('common.coinsPerHour')}
        </Text>
        <Button title={t('map.collect')} size="sm" style={styles.collectBtn} />
      </View>

      {/* Right-side shortcuts */}
      <View style={[styles.side, { bottom: TAB_BAR_HEIGHT + insets.bottom + 36 }]}>
        <SideButton icon="clipboard" label={t('map.missions')} onPress={() => router.push('/missions')} />
        <SideButton icon="storefront" label={t('map.market')} onPress={() => router.push('/marketplace')} />
        <SideButton icon="person" label={t('map.profile')} onPress={() => router.push('/profile')} />
      </View>

      <Pressable
        style={[styles.locate, { bottom: TAB_BAR_HEIGHT + insets.bottom + 36 }]}
        onPress={() => map.current?.recenter()}>
        <Ionicons name="locate" size={26} color={C.text} />
      </Pressable>
    </View>
  );
}

function SideButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.sideBtn} onPress={onPress}>
      <Ionicons name={icon} size={24} color={C.text} />
      <Text variant="tiny" style={styles.sideLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

const glass = { backgroundColor: 'rgba(10,16,14,0.88)', borderWidth: 1, borderColor: '#25332D' };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: S.md,
    paddingBottom: S.sm,
    backgroundColor: 'rgba(7,13,11,0.82)',
  },
  level: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  levelText: { width: 54, gap: 4 },
  balances: { flexDirection: 'row', alignItems: 'center', gap: S.lg },
  plus: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  collect: { position: 'absolute', alignSelf: 'center', padding: S.md, paddingBottom: S.md, borderRadius: R.lg, gap: S.sm, minWidth: 190, ...glass },
  collectBtn: { alignSelf: 'stretch' },
  side: { position: 'absolute', right: S.md, gap: S.md },
  sideBtn: { width: 58, height: 58, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', gap: 2, ...glass },
  sideLabel: { fontSize: 9 },
  locate: { position: 'absolute', left: S.md, width: 52, height: 52, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', ...glass },
});
