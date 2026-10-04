import { Ionicons } from '@expo/vector-icons';
import type { PlotDto } from '@landrush/shared';
import { cellAt, cellKey, type CellBounds } from '@landrush/shared/grid';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameMap, type GameMapHandle, type MapCell } from '@/components/game-map';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Amount } from '@/components/ui/currency';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { C, R, S, TAB_BAR_HEIGHT } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { incomePerHour, useGame } from '@/lib/game';
import { currentPosition, DEFAULT_POSITION } from '@/lib/location';

type IconName = keyof typeof Ionicons.glyphMap;

/** Drawing more free squares than this makes the map sluggish. */
const MAX_FREE_DRAWN = 400;
/** Wait for the map to stop moving before asking the server. */
const DEBOUNCE_MS = 350;

const toCell = (p: PlotDto): MapCell => ({
  key: p.key,
  row: p.row,
  col: p.col,
  rarity: p.rarity,
  boosted: p.boosted,
  mine: p.mine,
  owned: !!p.owner,
});

/** 4. Home / map. */
export default function MapRoute() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const map = useRef<GameMapHandle>(null);
  const { user } = useAuth();
  const { wallet, myPlots, version } = useGame();
  const [bounds, setBounds] = useState<CellBounds | null>(null);
  const [owned, setOwned] = useState<PlotDto[]>([]);
  const [free, setFree] = useState<PlotDto[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  // Start where the player's newest plot is (or Riga).
  const [initialCenter] = useState(() =>
    myPlots?.[0] ? { lat: myPlots[0].lat, lng: myPlots[0].lng } : DEFAULT_POSITION,
  );

  // Load plots for the visible area (and again after buying something).
  useEffect(() => {
    if (!bounds) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .mapPlots(bounds)
        .then((res) => {
          if (cancelled) return;
          setOwned(res.owned);
          setFree(res.free.length <= MAX_FREE_DRAWN ? res.free : []);
        })
        .catch(() => {});
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [bounds, version]);

  const cells = useMemo(() => [...free.map(toCell), ...owned.map(toCell)], [free, owned]);

  const openCell = (lat: number, lng: number) => {
    const key = cellKey(cellAt(lat, lng));
    setSelected(key);
    router.push(`/plot/${key}`);
  };

  const locate = async () => {
    const pos = await currentPosition();
    if (pos) map.current?.moveTo(pos);
  };

  return (
    <View style={styles.root}>
      <GameMap
        ref={map}
        cells={cells}
        selectedKey={selected}
        initialCenter={initialCenter}
        onRegionChange={setBounds}
        onPress={({ lat, lng }) => openCell(lat, lng)}
      />

      {/* Top bar: level, coins, gems */}
      <View style={[styles.topBar, { paddingTop: insets.top + S.xs }]}>
        <Pressable style={styles.level} onPress={() => router.push('/profile')}>
          <Avatar name={user?.displayName ?? '?'} size={38} ring={C.green} />
          <View style={styles.levelText}>
            <Text variant="smallBold">{t('common.lv', { level: user?.level ?? 1 })}</Text>
            <Progress value={(user?.xp ?? 0) / 1000} height={4} />
          </View>
        </Pressable>
        <View style={styles.balances}>
          <Amount value={wallet?.coins ?? '–'} variant="h3" iconSize={20} />
          <Amount value={wallet?.gems ?? '–'} icon="gem" variant="h3" iconSize={18} />
          <Pressable style={styles.plus} onPress={() => router.push('/shop')}>
            <Ionicons name="add" size={16} color="#06200D" />
          </Pressable>
        </View>
      </View>

      {/* Income + collect (collecting arrives in M3) */}
      <View style={[styles.collect, { top: insets.top + 64 }]}>
        <Text variant="h3" color={C.green} center>
          + {incomePerHour(myPlots)} {t('common.coinsPerHour')}
        </Text>
        <Button
          title={t('map.collect')}
          size="sm"
          style={styles.collectBtn}
          onPress={() => Alert.alert(t('map.collect'), t('common.comingSoon'))}
        />
      </View>

      {free.length === 0 && owned.length === 0 && bounds && (
        <View style={[styles.hint, { top: insets.top + 150 }]}>
          <Text variant="small" center>
            {t('map.zoomIn')}
          </Text>
        </View>
      )}

      {/* Right-side shortcuts */}
      <View style={[styles.side, { bottom: TAB_BAR_HEIGHT + insets.bottom + 36 }]}>
        <SideButton
          icon="clipboard"
          label={t('map.missions')}
          onPress={() => router.push('/missions')}
        />
        <SideButton
          icon="storefront"
          label={t('map.market')}
          onPress={() => router.push('/marketplace')}
        />
        <SideButton
          icon="person"
          label={t('map.profile')}
          onPress={() => router.push('/profile')}
        />
      </View>

      <Pressable
        style={[styles.locate, { bottom: TAB_BAR_HEIGHT + insets.bottom + 36 }]}
        onPress={locate}
        accessibilityLabel={t('map.myLocation')}>
        <Ionicons name="locate" size={26} color={C.text} />
      </Pressable>
    </View>
  );
}

function SideButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
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
  plus: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collect: {
    position: 'absolute',
    alignSelf: 'center',
    padding: S.md,
    borderRadius: R.lg,
    gap: S.sm,
    minWidth: 190,
    ...glass,
  },
  collectBtn: { alignSelf: 'stretch' },
  hint: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: S.md,
    paddingVertical: S.sm,
    borderRadius: R.pill,
    ...glass,
  },
  side: { position: 'absolute', right: S.md, gap: S.md },
  sideBtn: {
    width: 58,
    height: 58,
    borderRadius: R.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    ...glass,
  },
  sideLabel: { fontSize: 9 },
  locate: {
    position: 'absolute',
    left: S.md,
    width: 52,
    height: 52,
    borderRadius: R.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...glass,
  },
});
