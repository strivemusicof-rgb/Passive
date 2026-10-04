import Svg, { Circle, Path } from 'react-native-svg';
import { StyleSheet, View } from 'react-native';

import { C } from '@/constants/theme';

import { Text, type AppTextProps } from './text';

export function CoinIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Circle cx="10" cy="10" r="9.5" fill={C.coinDark} />
      <Circle cx="10" cy="9.3" r="8.8" fill={C.coin} />
      <Circle cx="10" cy="9.3" r="6" fill="none" stroke="#FFE9A3" strokeOpacity={0.75} strokeWidth="1.2" />
    </Svg>
  );
}

export function GemIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path d="M5 3h10l4 5-9 10L1 8z" fill={C.gem} />
      <Path d="M1 8h18M5 3l5 15M15 3l-5 15M5 3l2 5h6l2-5" stroke="#E6C7FF" strokeWidth="0.8" fill="none" />
    </Svg>
  );
}

/** ⭐ reward point (the cash-out currency). */
export function PointsIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path
        d="M10 1.2l2.6 5.4 5.9.8-4.3 4.1 1 5.9L10 14.6l-5.2 2.8 1-5.9L1.5 7.4l5.9-.8z"
        fill="#FFD23F"
        stroke="#E09A00"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

type AmountProps = Omit<AppTextProps, 'children'> & {
  value: number | string;
  suffix?: string;
  icon?: 'coin' | 'gem' | 'points';
  iconSize?: number;
};

/** "🟡 12/day" style amount with a coin or gem icon. */
export function Amount({ value, suffix, icon = 'coin', iconSize = 15, variant = 'bodyBold', ...rest }: AmountProps) {
  const text = typeof value === 'number' ? formatNumber(value) : value;
  return (
    <View style={styles.row}>
      {icon === 'coin' ? <CoinIcon size={iconSize} /> : icon === 'gem' ? <GemIcon size={iconSize} /> : <PointsIcon size={iconSize} />}
      <Text variant={variant} {...rest}>
        {text}
        {suffix}
      </Text>
    </View>
  );
}

export function formatNumber(n: number) {
  return n.toLocaleString('en-US');
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
