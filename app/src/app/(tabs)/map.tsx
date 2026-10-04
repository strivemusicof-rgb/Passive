import { Ionicons } from '@expo/vector-icons';
import type { PlotDto } from '@landrush/shared';
import { cellAt, cellKey, type CellBounds } from '@landrush/shared/grid';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CollectCard } from '@/components/collect-card';
import { DailyPopup } from '@/components/daily-popup';
import { GameMap, type GameMapHandle, type MapCell, type MapStyle } from '@/components/game-map';
import { Avatar } from '@/components/ui/avatar';
import { Amount } from '@/components/ui/currency';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { C, R, S, TAB_BAR_HEIGHT } from '@/constants/theme';
import { initAds } from '@/lib/ads';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useGame } from '@/lib/game';
import { currentPosition, DEFAULT_POSITION } from '@/lib/location';
import { prefs } from '@/lib/prefs';

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
  buildingLevel: p.buildingLevel,
});

/** 4. Home / map. */
export default function MapRoute() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const map = useRef<GameMapHandle>(null);
  const { user } = useAuth();
  const { wallet, myPlots, missions, daily, version } = useGame();
  const [bounds, setBounds] = useState<CellBounds | null>(null);
  const [owned, setOwned] = useState<PlotDto[]>([]);
  const [free, setFree] = useState<PlotDto[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>('dark');

  // Start where the player's newest plot is (or Riga).
  const [initialCenter] = useState(() =>
    myPlots?.[0] ? { lat: myPlots[0].lat, lng: myPlots[0].lng } : DEFAULT_POSITION,
  );

  // Plots often arrive after the map is shown: jump to them once.
  const centred = useRef(!!myPlots?.[0]);
  useEffect(() => {
    if (centred.current || !myPlots?.[0]) return;
    centred.current = true;
    map.current?.moveTo({ lat: myPlots[0].lat, lng: myPlots[0].lng });
  }, [myPlots]);

  // Get the ad SDK ready (EU consent + Apple's tracking question) a moment after the map shows.
  useEffect(() => {
    const id = setTimeout(() => initAds().catch(() => {}), 4000);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    prefs.get('mapStyle').then((v) => v === 'satellite' && setMapStyle('satellite'));
  }, []);

  const toggleStyle = () => {
    const next = mapStyle === 'dark' ? 'satellite' : 'dark';
    setMapStyle(next);
    prefs.set('mapStyle', next);
  };

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

  // Red dot on Missions when a reward is waiting.
  const missionWaiting =
    (daily && !daily.claimedToday) ||
    [...(missions?.daily ?? []), ...(missions?.weekly ?? [])].some(
      (m) => !m.claimed && m.progress >= m.target,
    );

  const openCell = (lat: number, lng: number) => {
    const key = cellKey(cellAt(lat, lng));
    setSelected(key);
    router.push(`/plot/${key}`);
  };

  const locate = async () => {
    const pos = await currentPosition();
    if (pos) map.current?.moveTo(pos);
  };

  const bottom = TAB_BAR_HEIGHT + insets.bottom + 28;

  return (
    <View style={styles.root}>
      <GameMap
        ref={map}
        cells={cells}
        selectedKey={selected}
        initialCenter={initialCenter}
        mapStyle={mapStyle}
        onRegionChange={setBounds}
        onPress={({ lat, lng }) => openCell(lat, lng)}
      />

      {/* Floating panels: level (left) and balances (right). Tap ⭐ for Rewards. */}
      <View style={[styles.topRow, { top: insets.top + S.xs }]} pointerEvents="box-none">
        <Pressable style={[styles.pill, styles.levelPill]} onPress={() => router.push('/profile')}>
          <Avatar name={user?.displayName ?? '?'} size={40} ring={C.green} />
          <View style={styles.levelText}>
            <Text variant="bodyBold">{t('common.lv', { level: user?.level ?? 1 })}</Text>
            <Progress value={user ? user.levelXp.current / user.levelXp.needed : 0} height={6} />
          </View>
        </Pressable>
        <View style={[styles.pill, styles.balances]}>
          <Amount value={wallet?.coins ?? '–'} variant="bodyBold" iconSize={20} />
          <View style={styles.sep} />
          <Amount value={wallet?.gems ?? '–'} icon="gem" variant="bodyBold" iconSize={17} />
          <View style={styles.sep} />
          <Pressable
            onPress={() => router.push('/rewards')}
            hitSlop={8}
            accessibilityLabel={t('rewards.title')}>
            <Amount
              value={wallet?.points ?? '–'}
              icon="points"
              variant="bodyBold"
              iconSize={19}
              color={C.coin}
            />
          </Pressable>
        </View>
      </View>

      <DailyPopup />

      {/* Income + collect, with the zoom hint underneath (the card grows when an ad is offered) */}
      <View style={[styles.collect, { top: insets.top + 70 }]} pointerEvents="box-none">
        <CollectCard />
        {free.length === 0 && owned.length === 0 && bounds && (
          <View style={styles.hint}>
            <Text variant="small" center>
              {t('map.zoomIn')}
            </Text>
          </View>
        )}
      </View>

      {/* Right-side shortcuts */}
      <View style={[styles.side, { bottom }]}>
        <SideButton
          icon="clipboard"
          label={t('map.missions')}
          dot={!!missionWaiting}
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

      {/* Left: map style + my location */}
      <View style={[styles.leftCol, { bottom }]}>
        <Pressable style={styles.round} onPress={toggleStyle} accessibilityLabel={t('map.style')}>
          <Ionicons name={mapStyle === 'dark' ? 'earth' : 'moon'} size={24} color={C.text} />
        </Pressable>
        <Pressable style={styles.round} onPress={locate} accessibilityLabel={t('map.myLocation')}>
          <Ionicons name="locate" size={26} color={C.text} />
        </Pressable>
      </View>
    </View>
  );
}

function SideButton({
  icon,
  label,
  dot,
  onPress,
}: {
  icon: IconName;
  label: string;
  dot?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.sideBtn} onPress={onPress}>
      <Ionicons name={icon} size={26} color={C.text} />
      <Text variant="tiny" style={styles.sideLabel}>
        {label}
      </Text>
      {dot && <View style={styles.dot} />}
    </Pressable>
  );
}

const glass = {
  backgroundColor: 'rgba(8,13,11,0.86)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.10)',
  shadowColor: '#000',
  shadowOpacity: 0.45,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topRow: {
    position: 'absolute',
    left: S.md,
    right: S.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pill: { flexDirection: 'row', alignItems: 'center', borderRadius: R.pill, ...glass },
  levelPill: { gap: S.sm, paddingLeft: 4, paddingRight: S.lg, paddingVertical: 4 },
  levelText: { width: 70, gap: 5 },
  balances: { gap: S.md, paddingHorizontal: S.lg, height: 48 },
  sep: { width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.15)' },
  collect: { position: 'absolute', alignSelf: 'center', alignItems: 'center', gap: S.sm },
  hint: {
    paddingHorizontal: S.md,
    paddingVertical: S.sm,
    borderRadius: R.pill,
    ...glass,
  },
  side: { position: 'absolute', right: S.md, gap: S.md },
  sideBtn: {
    width: 66,
    height: 66,
    borderRadius: R.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    ...glass,
  },
  sideLabel: { fontSize: 10 },
  dot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: C.green,
    borderWidth: 1.5,
    borderColor: '#0A100E',
  },
  leftCol: { position: 'absolute', left: S.md, gap: S.md },
  round: {
    width: 56,
    height: 56,
    borderRadius: R.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...glass,
  },
});
