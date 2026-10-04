import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { C, S, TAB_BAR_HEIGHT } from '@/constants/theme';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  /** Leaves room for the custom tab bar. */
  tabs?: boolean;
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({ children, scroll = true, tabs, footer, contentStyle }: Props) {
  const content = [styles.content, tabs && { paddingBottom: TAB_BAR_HEIGHT + S.lg }, contentStyle];
  return (
    <SafeAreaView style={styles.safe} edges={tabs ? ['top'] : ['top', 'bottom']}>
      {scroll ? (
        <ScrollView contentContainerStyle={content} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[content, styles.fill]}>{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: S.lg, paddingTop: S.md, gap: S.md },
  fill: { flex: 1 },
  footer: { paddingHorizontal: S.lg, paddingBottom: S.sm, gap: S.md },
});
