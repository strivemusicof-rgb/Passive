import { StyleSheet, View, type ViewProps } from 'react-native';

import { C, R } from '@/constants/theme';

export function Card({ style, ...rest }: ViewProps) {
  return <View style={[styles.card, style]} {...rest} />;
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.divider },
});
