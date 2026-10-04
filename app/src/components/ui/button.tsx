import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { C, R, S } from '@/constants/theme';

import { Text } from './text';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'blue' | 'outline' | 'light';
  size?: 'md' | 'sm';
  icon?: ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Green gradient (primary), dark outlined (outline) or white (light, e.g. Apple). */
export function Button({ title, onPress, variant = 'primary', size = 'md', icon, disabled, style }: Props) {
  const height = size === 'md' ? 52 : 30;
  const radius = size === 'md' ? R.md : R.sm;
  const textColor = variant === 'primary' ? '#06200D' : variant === 'light' ? '#000' : C.text;
  const gradient: [string, string] | null =
    variant === 'primary' ? ['#52E86A', C.greenDark] : variant === 'blue' ? ['#4C8DFF', '#1F5FD6'] : null;
  const label = (
    <View style={styles.row}>
      {icon}
      <Text variant={size === 'md' ? 'bodyBold' : 'smallBold'} color={textColor}>
        {title}
      </Text>
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [{ opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }, style]}>
      {gradient ? (
        <LinearGradient
          colors={gradient}
          style={[styles.base, { height, borderRadius: radius, paddingHorizontal: size === 'md' ? S.lg : S.md }]}>
          {label}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.base,
            { height, borderRadius: radius, paddingHorizontal: S.lg },
            variant === 'outline' ? styles.outline : styles.light,
          ]}>
          {label}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  outline: { backgroundColor: C.card, borderWidth: 1, borderColor: '#2E3A35' },
  light: { backgroundColor: '#FFFFFF' },
});
