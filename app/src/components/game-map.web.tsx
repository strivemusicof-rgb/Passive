// Web preview only (react-native-maps has no web support). Draws the plot
// squares on a dark "satellite-like" background so layouts can be checked in
// a browser. The iPhone app uses game-map.tsx.
import { forwardRef, useImperativeHandle } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { RARITY_COLORS } from '@/constants/theme';

import type { GameMapHandle, MapPlot } from './game-map';

export type { GameMapHandle, MapPlot };

type Props = { plots: MapPlot[]; center: { lat: number; lng: number }; onPlotPress?: (id: number) => void };

export const GameMap = forwardRef<GameMapHandle, Props>(function GameMap({ plots, center, onPlotPress }, ref) {
  useImperativeHandle(ref, () => ({ recenter: () => {} }));
  const scale = 26000;
  return (
    <View style={[StyleSheet.absoluteFill, styles.bg]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="land" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#2B3A2E" />
            <Stop offset="1" stopColor="#1C2620" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#land)" />
        <Path d="M -20 120 C 120 180, 140 300, 230 420 S 330 640, 300 900" stroke="#1F3D57" strokeWidth={70} fill="none" />
      </Svg>
      {plots.map((p) => {
        const c = RARITY_COLORS[p.rarity].map;
        return (
          <Pressable
            key={p.id}
            onPress={() => onPlotPress?.(p.id)}
            style={{
              position: 'absolute',
              left: `${50 + (p.lng - center.lng) * scale * 0.55 / 4}%`,
              top: `${45 - (p.lat - center.lat) * scale / 4}%`,
              width: 30,
              height: 30,
              transform: [{ rotate: '45deg' }],
              backgroundColor: `${c}66`,
              borderColor: c,
              borderWidth: p.mine ? 2.5 : 1.5,
            }}
          />
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({ bg: { backgroundColor: '#1A241E' } });
