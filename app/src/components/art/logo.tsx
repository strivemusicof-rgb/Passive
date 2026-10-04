import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { Text } from '@/components/ui/text';
import { C } from '@/constants/theme';

/** Green skyline mark + LANDRUSH wordmark + tagline. */
export function Logo({ width = 260 }: { width?: number }) {
  const scale = width / 260;
  return (
    <View style={styles.wrap}>
      <SkylineMark width={140 * scale} />
      <Text style={[styles.word, { fontSize: 46 * scale, lineHeight: 52 * scale }]}>LANDRUSH</Text>
      <Text style={[styles.tagline, { fontSize: 12 * scale, letterSpacing: 3 * scale }]}>OWN. BUILD. EXPAND.</Text>
    </View>
  );
}

export function SkylineMark({ width = 140 }: { width?: number }) {
  return (
    <Svg width={width} height={width * 0.6} viewBox="0 0 140 84">
      <Defs>
        <LinearGradient id="mark" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#7BFF8A" />
          <Stop offset="1" stopColor="#1FA83A" />
        </LinearGradient>
      </Defs>
      {/* roof chevron */}
      <Path d="M8 52 L70 8 L132 52 L122 52 L70 16 L18 52 Z" fill="url(#mark)" />
      {/* buildings */}
      <Rect x="34" y="50" width="12" height="30" fill="url(#mark)" />
      <Rect x="49" y="38" width="12" height="42" fill="url(#mark)" />
      <Path d="M64 80 V30 L70 22 L76 30 V80 Z" fill="url(#mark)" />
      <Rect x="79" y="42" width="12" height="38" fill="url(#mark)" />
      <Rect x="94" y="54" width="12" height="26" fill="url(#mark)" />
      <Rect x="20" y="62" width="11" height="18" fill="url(#mark)" />
      <Rect x="109" y="64" width="11" height="16" fill="url(#mark)" />
      <Rect x="10" y="80" width="120" height="3" rx="1.5" fill="url(#mark)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  word: {
    color: C.text,
    fontWeight: '900',
    textShadowColor: 'rgba(63,217,88,0.45)',
    textShadowRadius: 18,
  },
  tagline: { color: '#DDE7E1', fontWeight: '700', marginTop: 4 },
});
