import type { UserStyle } from '@landrush/shared';
import { StyleSheet, View } from 'react-native';

import { Text } from './text';

const PALETTE = ['#2F855A', '#2B6CB0', '#9F7AEA', '#C05621', '#B83280', '#2C7A7B', '#B7791F'];

/**
 * Initials avatar (until players can upload photos). A bought `frame` replaces
 * the plain `ring`: a glowing ring, with an outer accent ring when it has one.
 */
export function Avatar({
  name,
  size = 28,
  ring,
  frame,
}: {
  name: string;
  size?: number;
  ring?: string;
  frame?: UserStyle['frame'];
}) {
  const color = PALETTE[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % PALETTE.length];
  const outer = size;
  const width = Math.max(2, outer / 16);
  // An accent ring sits inside the same footprint, so layouts don't shift.
  if (frame?.accent) size = outer - width * 3;
  const inner = (
    <View
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        frame
          ? {
              borderWidth: width,
              borderColor: frame.color,
              shadowColor: frame.color,
              shadowOpacity: 0.9,
              shadowRadius: size / 6,
              shadowOffset: { width: 0, height: 0 },
            }
          : ring
            ? { borderWidth: Math.max(2, size / 24), borderColor: ring }
            : null,
      ]}>
      <Text style={{ fontSize: size * 0.4, fontWeight: '700' }}>{name.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
  if (!frame?.accent) return inner;
  return (
    <View
      style={[
        styles.base,
        { width: outer, height: outer, borderRadius: outer / 2, borderWidth: Math.max(1, width / 2), borderColor: frame.accent },
      ]}>
      {inner}
    </View>
  );
}

/** A player's name in their bought name colour. */
export function nameColor(style: UserStyle | null | undefined, fallback?: string) {
  return style?.nameColor ?? fallback;
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
