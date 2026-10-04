import { StyleSheet, View } from 'react-native';

import { Text } from './text';

const PALETTE = ['#2F855A', '#2B6CB0', '#9F7AEA', '#C05621', '#B83280', '#2C7A7B', '#B7791F'];

/** Initials avatar (until players can upload photos). */
export function Avatar({ name, size = 28, ring }: { name: string; size?: number; ring?: string }) {
  const color = PALETTE[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % PALETTE.length];
  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        ring ? { borderWidth: Math.max(2, size / 24), borderColor: ring } : null,
      ]}>
      <Text style={{ fontSize: size * 0.4, fontWeight: '700' }}>{name.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
