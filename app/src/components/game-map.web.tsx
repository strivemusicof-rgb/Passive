// Web preview only (react-native-maps has no web support). A flat map with
// the plot squares, so flows can be tested in a browser. Tapping works; the
// view can't be dragged. The iPhone app uses game-map.tsx (Apple Maps).
import { cellBounds } from '@landrush/shared/grid';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { BUILDING_ICONS, tileColor } from '@/lib/plot-shape';

import {
  type GameMapHandle,
  type GameMapProps,
  type LatLng,
  type MapCell,
  type MapStyle,
} from './game-map';

export type { GameMapHandle, LatLng, MapCell, MapStyle };

const C_FREE = '#FFFFFF';
const C_LANDMARK = '#F6C453';

/** Pixels per degree of latitude (a 33 m plot ≈ 36 px). */
const PX_PER_DEG = 120000;

export const GameMap = forwardRef<GameMapHandle, GameMapProps>(function GameMap(
  { cells, selectedKey, initialCenter, mapStyle, onRegionChange, onPress },
  ref,
) {
  const [center, setCenter] = useState(initialCenter);
  const [size, setSize] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const lngScale = Math.cos((center.lat * Math.PI) / 180);

  useImperativeHandle(ref, () => ({ moveTo: (at) => setCenter(at) }));

  useEffect(() => {
    if (!size) return;
    const halfLat = size.h / 2 / PX_PER_DEG;
    const halfLng = size.w / 2 / (PX_PER_DEG * lngScale);
    onRegionChange({
      south: center.lat - halfLat,
      north: center.lat + halfLat,
      west: center.lng - halfLng,
      east: center.lng + halfLng,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, center]);

  if (!size)
    return (
      <View
        style={[StyleSheet.absoluteFill, styles.bg]}
        onLayout={(e: LayoutChangeEvent) =>
          setSize({
            x: e.nativeEvent.layout.x,
            y: e.nativeEvent.layout.y,
            w: e.nativeEvent.layout.width,
            h: e.nativeEvent.layout.height,
          })
        }
      />
    );

  const toPx = (lat: number, lng: number) => ({
    x: size.w / 2 + (lng - center.lng) * PX_PER_DEG * lngScale,
    y: size.h / 2 - (lat - center.lat) * PX_PER_DEG,
  });

  return (
    <Pressable
      style={[StyleSheet.absoluteFill, mapStyle === 'satellite' ? styles.sat : styles.bg]}
      onPress={(e) => {
        // react-native-web gives page coordinates; the map is laid out from (x, y).
        const locationX = e.nativeEvent.pageX - size.x;
        const locationY = e.nativeEvent.pageY - size.y;
        onPress({
          lat: center.lat - (locationY - size.h / 2) / PX_PER_DEG,
          lng: center.lng + (locationX - size.w / 2) / (PX_PER_DEG * lngScale),
        });
      }}>
      {cells.map((c: MapCell) => {
        const b = cellBounds(c);
        const tl = toPx(b.north, b.west);
        const br = toPx(b.south, b.east);
        const w = br.x - tl.x;
        const gap = w * 0.06;
        const color = c.owned ? tileColor(c) : C_FREE;
        const selected = c.key === selectedKey;
        return (
          <View
            key={c.key}
            pointerEvents="none"
            // data attributes help browser tests find plots
            {...({
              dataSet: {
                plot: c.key,
                owned: String(c.owned),
                mine: String(c.mine),
                rarity: c.rarity ?? 'free',
                boosted: String(c.boosted),
              },
            } as object)}
            style={{
              position: 'absolute',
              left: tl.x + gap,
              top: tl.y + gap,
              width: w - 2 * gap,
              height: br.y - tl.y - 2 * gap,
              borderRadius: w * 0.2,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: c.owned
                ? `${color}${c.mine ? '66' : '40'}`
                : c.boosted
                  ? `${C_LANDMARK}22`
                  : `${C_FREE}0A`,
              borderColor: selected ? '#FFFFFF' : c.owned ? color : `${C_FREE}38`,
              borderWidth: selected ? 2.5 : c.owned ? 2 : 0.8,
              ...(c.owned ? { boxShadow: `0 0 ${c.mine ? 14 : 8}px ${color}` } : null),
            }}>
            {c.owned && (
              <MaterialCommunityIcons
                name={BUILDING_ICONS[c.buildingLevel] ?? 'pine-tree'}
                size={w * 0.45}
                color={c.forSale ? C_LANDMARK : 'rgba(255,255,255,0.9)'}
              />
            )}
            {c.owned && c.flag && <Text style={[styles.flag, { fontSize: w * 0.28 }]}>{c.flag}</Text>}
            {selected && (
              <Ionicons
                name="location"
                size={30}
                color="#2F7CF6"
                style={{ position: 'absolute', top: -18 }}
              />
            )}
          </View>
        );
      })}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  flag: { position: 'absolute', top: -2, right: 0 },
  bg: { backgroundColor: '#1B2026', overflow: 'hidden' },
  sat: { backgroundColor: '#2B3326', overflow: 'hidden' },
});
