import { StyleSheet, View } from 'react-native';

import { PlotArt, type BuildingKind } from '@/components/art/plot-art';
import { R } from '@/constants/theme';

/** Small framed plot illustration used in lists. */
export function PlotThumb({ kind, size = 58 }: { kind: BuildingKind; size?: number }) {
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <PlotArt kind={kind} size={size * 1.5} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: R.sm, backgroundColor: '#0B1310', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
