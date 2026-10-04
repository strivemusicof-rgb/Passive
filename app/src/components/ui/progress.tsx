import { StyleSheet, View } from 'react-native';

import { C } from '@/constants/theme';

export function Progress({ value, height = 5, color = C.green }: { value: number; height?: number; color?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View style={[styles.track, { height, borderRadius: height }]}>
      <View style={{ width: `${pct}%`, height, borderRadius: height, backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: '#25302B', overflow: 'hidden', flexGrow: 1 },
});
