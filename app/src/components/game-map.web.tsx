// Web preview only (react-native-maps has no web support). A flat map with
// the plot squares, so flows can be tested in a browser. Tapping works; the
// view can't be dragged. The iPhone app uses game-map.tsx (Apple Maps).
import { cellBounds } from '@landrush/shared/grid';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { RARITY_COLORS } from '@/constants/theme';

import type { GameMapHandle, GameMapProps, LatLng, MapCell } from './game-map';

export type { GameMapHandle, LatLng, MapCell };

const C_FREE = '#FFFFFF';
const C_LANDMARK = '#F6C453';

/** Pixels per degree of latitude (a 33 m plot ≈ 36 px). */
const PX_PER_DEG = 120000;

export const GameMap = forwardRef<GameMapHandle, GameMapProps>(function GameMap(
  { cells, selectedKey, initialCenter, onRegionChange, onPress },
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
      style={[StyleSheet.absoluteFill, styles.bg]}
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
        // Owned: rarity colour. Free: thin white outline, faint gold fill near landmarks.
        const color = c.rarity ? RARITY_COLORS[c.rarity].map : C_FREE;
        const fill = c.owned
          ? `${color}${c.mine ? 'AA' : '66'}`
          : c.boosted
            ? `${C_LANDMARK}26`
            : `${C_FREE}0D`;
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
              left: tl.x,
              top: tl.y,
              width: br.x - tl.x - 1,
              height: br.y - tl.y - 1,
              backgroundColor: fill,
              borderColor: selected ? '#FFFFFF' : `${color}${c.owned ? 'FF' : '40'}`,
              borderWidth: selected ? 2 : c.owned ? 1.5 : 0.5,
            }}
          />
        );
      })}
    </Pressable>
  );
});

const styles = StyleSheet.create({ bg: { backgroundColor: '#1F2A22', overflow: 'hidden' } });
