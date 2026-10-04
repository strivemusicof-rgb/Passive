import type { Rarity } from '@landrush/shared';
import { cellBounds, type CellBounds } from '@landrush/shared/grid';
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Polygon, type Region } from 'react-native-maps';

import { RARITY_COLORS } from '@/constants/theme';

const C_FREE = '#FFFFFF';
const C_LANDMARK = '#F6C453';

/** rarity is null for free cells; boosted = free cell near a landmark (better odds). */
export type MapCell = {
  key: string;
  row: number;
  col: number;
  rarity: Rarity | null;
  boosted: boolean;
  mine: boolean;
  owned: boolean;
};
export type LatLng = { lat: number; lng: number };
export type GameMapHandle = { moveTo: (at: LatLng) => void };

export type GameMapProps = {
  cells: MapCell[];
  selectedKey?: string | null;
  initialCenter: LatLng;
  /** Visible area, after the player stops moving the map. */
  onRegionChange: (bounds: CellBounds) => void;
  /** Any tap on the map (owned or free cell). */
  onPress: (at: LatLng) => void;
};

/** Zoomed in enough to see individual plots (~400 m across). */
const DEFAULT_DELTA = 0.004;

function toBounds(r: Region): CellBounds {
  return {
    south: r.latitude - r.latitudeDelta / 2,
    north: r.latitude + r.latitudeDelta / 2,
    west: r.longitude - r.longitudeDelta / 2,
    east: r.longitude + r.longitudeDelta / 2,
  };
}

/** Apple Maps satellite view with plot squares coloured by rarity. */
export const GameMap = forwardRef<GameMapHandle, GameMapProps>(function GameMap(
  { cells, selectedKey, initialCenter, onRegionChange, onPress },
  ref,
) {
  const map = useRef<MapView>(null);

  useImperativeHandle(ref, () => ({
    moveTo: (at) =>
      map.current?.animateToRegion(
        {
          latitude: at.lat,
          longitude: at.lng,
          latitudeDelta: DEFAULT_DELTA,
          longitudeDelta: DEFAULT_DELTA,
        },
        400,
      ),
  }));

  const squares = useMemo(
    () =>
      cells.map((c) => {
        const b = cellBounds(c);
        return {
          ...c,
          coords: [
            { latitude: b.south, longitude: b.west },
            { latitude: b.south, longitude: b.east },
            { latitude: b.north, longitude: b.east },
            { latitude: b.north, longitude: b.west },
          ],
        };
      }),
    [cells],
  );

  return (
    <MapView
      ref={map}
      style={StyleSheet.absoluteFill}
      mapType="hybrid"
      initialRegion={{
        latitude: initialCenter.lat,
        longitude: initialCenter.lng,
        latitudeDelta: DEFAULT_DELTA,
        longitudeDelta: DEFAULT_DELTA,
      }}
      showsUserLocation
      showsCompass={false}
      showsPointsOfInterests={false}
      onMapReady={() =>
        map.current?.getMapBoundaries().then((b) =>
          onRegionChange({
            south: b.southWest.latitude,
            west: b.southWest.longitude,
            north: b.northEast.latitude,
            east: b.northEast.longitude,
          }),
        )
      }
      onRegionChangeComplete={(r) => onRegionChange(toBounds(r))}
      onPress={(e) =>
        onPress({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })
      }>
      {squares.map((c) => {
        // Owned: rarity colour. Free: thin white outline, faint gold fill near landmarks.
        const color = c.rarity ? RARITY_COLORS[c.rarity].map : C_FREE;
        const fill = c.owned
          ? `${color}${c.mine ? 'AA' : '66'}`
          : c.boosted
            ? `${C_LANDMARK}26`
            : `${C_FREE}0D`;
        const selected = c.key === selectedKey;
        return (
          <Polygon
            key={c.key}
            coordinates={c.coords}
            fillColor={fill}
            strokeColor={selected ? '#FFFFFF' : `${color}${c.owned ? 'FF' : '40'}`}
            strokeWidth={selected ? 3 : c.mine ? 2.5 : c.owned ? 1.5 : 0.8}
            zIndex={selected ? 3 : c.owned ? 2 : 1}
          />
        );
      })}
    </MapView>
  );
});
