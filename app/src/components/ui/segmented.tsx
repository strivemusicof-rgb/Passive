import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { C, R, S } from '@/constants/theme';

import { Text } from './text';

type Props<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** 'pills' = separate chips (filters), 'bar' = equal-width joined tabs. */
  variant?: 'pills' | 'bar';
};

export function Segmented<T extends string>({ options, value, onChange, variant = 'pills' }: Props<T>) {
  if (variant === 'bar') {
    return (
      <View style={styles.bar}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable key={o.value} style={[styles.barItem, active && styles.active]} onPress={() => onChange(o.value)}>
              <Text variant="smallBold" color={active ? C.text : C.textSecondary}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} style={[styles.pill, active && styles.active]} onPress={() => onChange(o.value)}>
            <Text variant="small" color={active ? C.text : C.textSecondary} style={active && styles.bold}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pills: { gap: S.sm },
  pill: {
    paddingHorizontal: 14,
    height: 32,
    justifyContent: 'center',
    borderRadius: R.pill,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 2,
  },
  barItem: { flex: 1, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: R.pill },
  active: { backgroundColor: C.greenSoft, borderColor: C.green, borderWidth: 1 },
  bold: { fontWeight: '700' },
});
