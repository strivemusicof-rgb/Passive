import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { C, S } from '@/constants/theme';

import { Text } from './text';

type IconName = keyof typeof Ionicons.glyphMap;

/** Icon + label + chevron row for settings-style lists. */
export function MenuRow({ icon, label, onPress, last }: { icon: IconName; label: string; onPress?: () => void; last?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, !last && styles.border, pressed && styles.pressed]}>
      <Ionicons name={icon} size={20} color={C.text} />
      <Text variant="small" style={styles.label}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={18} color={C.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingHorizontal: S.lg, height: 52 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.divider },
  pressed: { backgroundColor: C.cardPressed },
  label: { flex: 1 },
});
