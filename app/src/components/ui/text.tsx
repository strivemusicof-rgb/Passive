import { StyleSheet, Text as RNText, type TextProps } from 'react-native';

import { C } from '@/constants/theme';

type Variant = 'h1' | 'h2' | 'h3' | 'body' | 'bodyBold' | 'small' | 'smallBold' | 'tiny';

export type AppTextProps = TextProps & { variant?: Variant; color?: string; center?: boolean };

export function Text({ variant = 'body', color, center, style, ...rest }: AppTextProps) {
  return (
    <RNText
      style={[styles[variant], { color: color ?? C.text }, center && styles.center, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 26, fontWeight: '700', letterSpacing: -0.3 },
  h2: { fontSize: 22, fontWeight: '700' },
  h3: { fontSize: 17, fontWeight: '700' },
  body: { fontSize: 15, fontWeight: '500' },
  bodyBold: { fontSize: 15, fontWeight: '700' },
  small: { fontSize: 13, fontWeight: '500' },
  smallBold: { fontSize: 13, fontWeight: '700' },
  tiny: { fontSize: 11, fontWeight: '600' },
  center: { textAlign: 'center' },
});
