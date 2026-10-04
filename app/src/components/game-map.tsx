import type { Rarity } from '@landrush/shared';
import { cellAt, cellBounds } from '@landrush/shared/grid';
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Polygon } from 'react-native-maps';

import { RARITY_COLORS } from '@/constants/theme';

export type MapPlot = { id: number; lat: number; lng: number; rarity: Rarity; mine?: boolean };
export type GameMapHandle = { recenter: () => void };

type Props = {
  plots: MapPlot[];
  center: { lat: number; lng: number };
  onPlotPress?: (id: number) => void;
};

/** Satellite map with plot squares coloured by rarity. */
export const GameMap = forwardRef<GameMapHandle, Props>(function GameMap({ plots, center, onPlotPress }, ref) {
  const map = useRef<MapView>(null);
  const region = {
    latitude: center.lat,
    longitude: center.lng,
    latitudeDelta: 0.012,
    longitudeDelta: 0.012,
  };

  useImperativeHandle(ref, () => ({
    recenter: () => map.current?.animateToRegion(region, 400),
  }));

  const squares = useMemo(
    () =>
      plots.map((p) => {
        const b = cellBounds(cellAt(p.lat, p.lng));
        return {
          ...p,
          coords: [
            { latitude: b.south, longitude: b.west },
            { latitude: b.south, longitude: b.east },
            { latitude: b.north, longitude: b.east },
            { latitude: b.north, longitude: b.west },
          ],
        };
      }),
    [plots],
  );

  return (
    <MapView
      ref={map}
      style={StyleSheet.absoluteFill}
      mapType="hybrid"
      initialRegion={region}
      showsUserLocation
      showsCompass={false}
      showsPointsOfInterests={false}
      pitchEnabled
      rotateEnabled>
      {squares.map((p) => {
        const color = RARITY_COLORS[p.rarity].map;
        return (
          <Polygon
            key={p.id}
            coordinates={p.coords}
            fillColor={`${color}${p.mine ? '88' : '55'}`}
            strokeColor={color}
            strokeWidth={p.mine ? 2.5 : 1.5}
            tappable
            onPress={() => onPlotPress?.(p.id)}
          />
        );
      })}
    </MapView>
  );
});
