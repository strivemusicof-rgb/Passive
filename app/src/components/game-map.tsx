import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { Rarity } from '@landrush/shared';
import { cellCenter, type CellBounds } from '@landrush/shared/grid';
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polygon, type Region } from 'react-native-maps';

import { BUILDING_ICONS, roundedCell, tileColor } from '@/lib/plot-shape';

/** rarity is null for free cells; boosted = free cell near a landmark (better odds). */
export type MapCell = {
  key: string;
  row: number;
  col: number;
  rarity: Rarity | null;
  boosted: boolean;
  mine: boolean;
  owned: boolean;
  buildingLevel: number;
  /** On sale on the marketplace: the icon turns gold. */
  forSale?: boolean;
  /** Bought plot skin: replaces the rarity colour. */
  skinColor?: string | null;
  /** Bought plot flag (emoji), shown on the tile. */
  flag?: string | null;
};
export type LatLng = { lat: number; lng: number };
export type GameMapHandle = { moveTo: (at: LatLng) => void };
export type MapStyle = 'dark' | 'satellite';

export type GameMapProps = {
  cells: MapCell[];
  selectedKey?: string | null;
  initialCenter: LatLng;
  mapStyle: MapStyle;
  /** Visible area, after the player stops moving the map. */
  onRegionChange: (bounds: CellBounds) => void;
  /** Any tap on the map (owned or free cell). */
  onPress: (at: LatLng) => void;
};

/** Zoomed in enough to see individual plots (~400 m across). */
const DEFAULT_DELTA = 0.004;
/** Building icons only when plots are big enough on screen. */
const ICONS_BELOW_DELTA = 0.012;
const MAX_ICONS = 150;

const C_FREE = '#FFFFFF';
const C_LANDMARK = '#F6C453';

function toBounds(r: Region): CellBounds {
  return {
    south: r.latitude - r.latitudeDelta / 2,
    north: r.latitude + r.latitudeDelta / 2,
    west: r.longitude - r.longitudeDelta / 2,
    east: r.longitude + r.longitudeDelta / 2,
  };
}

/** Apple Maps (dark or satellite) with glowing, rounded plot tiles. */
export const GameMap = forwardRef<GameMapHandle, GameMapProps>(function GameMap(
  { cells, selectedKey, initialCenter, mapStyle, onRegionChange, onPress },
  ref,
) {
  const map = useRef<MapView>(null);
  const [delta, setDelta] = useState(DEFAULT_DELTA);

  useImperativeHandle(ref, () => ({
    moveTo: (at) =>
      map.current?.animateToRegion(
        { latitude: at.lat, longitude: at.lng, latitudeDelta: DEFAULT_DELTA, longitudeDelta: DEFAULT_DELTA },
        400,
      ),
  }));

  const shapes = useMemo(() => cells.map((c) => ({ ...c, coords: roundedCell(c) })), [cells]);
  const owned = shapes.filter((c) => c.owned);
  const selected = cells.find((c) => c.key === selectedKey);

  return (
    <MapView
      ref={map}
      style={StyleSheet.absoluteFill}
      mapType={mapStyle === 'satellite' ? 'hybrid' : 'mutedStandard'}
      userInterfaceStyle="dark"
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
      onRegionChangeComplete={(r) => {
        setDelta(r.latitudeDelta);
        onRegionChange(toBounds(r));
      }}
      onPress={(e) =>
        onPress({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })
      }>
      {/* Free cells: faint outline; gold tint near landmarks. */}
      {shapes
        .filter((c) => !c.owned)
        .map((c) => (
          <Polygon
            key={c.key}
            coordinates={c.coords}
            fillColor={c.boosted ? `${C_LANDMARK}22` : `${C_FREE}0A`}
            strokeColor={c.key === selectedKey ? '#FFFFFF' : `${C_FREE}38`}
            strokeWidth={c.key === selectedKey ? 2.5 : 0.8}
            zIndex={1}
          />
        ))}

      {/* Owned plots: a wide faint stroke underneath gives the glow, then the tile itself. */}
      {owned.map((c) => {
        const color = tileColor(c);
        return (
          <Polygon
            key={`${c.key}-glow`}
            coordinates={c.coords}
            fillColor="transparent"
            strokeColor={`${color}${c.mine ? '55' : '33'}`}
            strokeWidth={c.mine ? 9 : 6}
            zIndex={2}
          />
        );
      })}
      {owned.map((c) => {
        const color = tileColor(c);
        return (
          <Polygon
            key={c.key}
            coordinates={c.coords}
            fillColor={`${color}${c.mine ? '66' : '40'}`}
            strokeColor={c.key === selectedKey ? '#FFFFFF' : color}
            strokeWidth={c.key === selectedKey ? 3 : 2}
            zIndex={3}
          />
        );
      })}

      {/* Building icons in the middle of owned plots (only when zoomed in). */}
      {delta < ICONS_BELOW_DELTA &&
        owned.slice(0, MAX_ICONS).map((c) => {
          const at = cellCenter(c);
          return (
            <Marker
              // The marker is drawn once (tracksViewChanges off), so a change must give it a new key.
              key={`${c.key}-icon-${c.buildingLevel}-${c.forSale ? 's' : ''}-${c.flag ?? ''}-${delta < 0.005 ? 'l' : 's'}`}
              coordinate={{ latitude: at.lat, longitude: at.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              onPress={() => onPress(at)}
              zIndex={4}>
              <View style={styles.iconWrap}>
                <MaterialCommunityIcons
                  name={BUILDING_ICONS[c.buildingLevel] ?? 'pine-tree'}
                  size={delta < 0.005 ? 22 : 16}
                  color={c.forSale ? C_LANDMARK : 'rgba(255,255,255,0.9)'}
                  style={styles.iconShadow}
                />
                {c.flag && <Text style={[styles.flag, { fontSize: delta < 0.005 ? 13 : 10 }]}>{c.flag}</Text>}
              </View>
            </Marker>
          );
        })}

      {/* Pin on the selected plot. */}
      {selected && (
        <Marker
          key={`pin-${selected.key}`}
          coordinate={{ latitude: cellCenter(selected).lat, longitude: cellCenter(selected).lng }}
          anchor={{ x: 0.5, y: 1 }}
          tracksViewChanges={false}
          zIndex={5}>
          <View style={styles.pin}>
            <Ionicons name="location" size={34} color="#2F7CF6" />
          </View>
        </Marker>
      )}
    </MapView>
  );
});

const styles = StyleSheet.create({
  iconWrap: { paddingTop: 6, paddingRight: 8 },
  flag: { position: 'absolute', top: 0, right: 0 },
  iconShadow: { textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  pin: { shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
});
