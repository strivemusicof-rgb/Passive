import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { C } from '@/constants/theme';

type Props = { value: number; height?: number; color?: string; style?: StyleProp<ViewStyle> };

/** Thin progress bar. Full width in a column; pass `style={{ flex: 1 }}` inside a row. */
export function Progress({ value, height = 5, color = C.green, style }: Props) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View style={[styles.track, { height, borderRadius: height }, style]}>
      <View style={{ width: `${pct}%`, height, borderRadius: height, backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: '#25302B', overflow: 'hidden', alignSelf: 'stretch' },
});
