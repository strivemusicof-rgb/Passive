import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { C, S } from '@/constants/theme';

import { Text } from './text';

/** Screen title row with an optional close (X) button or custom right element. */
export function Header({ title, subtitle, close, right }: { title: string; subtitle?: string; close?: boolean; right?: ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.titles}>
        <Text variant="h1">{title}</Text>
        {subtitle ? (
          <Text variant="small" color={C.textSecondary}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {close ? (
        <Pressable hitSlop={12} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={C.text} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: S.md, minHeight: 36 },
  titles: { flex: 1, gap: 2 },
});
