import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { C, R, S } from '@/constants/theme';

import { Text } from './text';

export function Input({ label, hint, style, ...rest }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={styles.wrap}>
      <Text variant="smallBold" color={C.textSecondary}>
        {label}
      </Text>
      <TextInput placeholderTextColor={C.textMuted} style={[styles.input, style]} {...rest} />
      {hint ? (
        <Text variant="tiny" color={C.textMuted}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  input: {
    height: 50,
    paddingHorizontal: S.lg,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: '#2E3A35',
    backgroundColor: C.card,
    color: C.text,
    fontSize: 16,
  },
});
