import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { C, S } from '@/constants/theme';

import { Text } from './text';

/** "Label ........ value" row inside a details card. */
export function InfoRow({ label, children, last }: { label: string; children: ReactNode; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.border]}>
      <Text variant="small" color={C.textSecondary}>
        {label}
      </Text>
      {typeof children === 'string' ? <Text variant="smallBold">{children}</Text> : children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.lg, height: 48 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.divider },
});
