import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { DailyStreak } from '@/components/daily-streak';
import { Text } from '@/components/ui/text';
import { C, S } from '@/constants/theme';
import { useGame } from '@/lib/game';

/** Shown on the map once per app start while today's daily reward is waiting. */
let dismissedThisSession = false;

export function DailyPopup() {
  const { t } = useTranslation();
  const { daily } = useGame();
  const [hidden, setHidden] = useState(dismissedThisSession);
  const [message, setMessage] = useState<string | null>(null);
  const open = !!daily && (!daily.claimedToday || !!message) && !hidden;

  const close = () => {
    dismissedThisSession = true;
    setHidden(true);
  };

  if (!daily) return null;
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Pressable
            style={styles.close}
            onPress={close}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}>
            <Ionicons name="close" size={22} color={C.text} />
          </Pressable>
          <DailyStreak
            daily={daily}
            onClaimed={(text) => {
              setMessage(text);
              setTimeout(close, 1800);
            }}
          />
          {message && (
            <Text variant="h3" color={C.coin} center>
              {message}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: S.lg,
  },
  sheet: { gap: S.md },
  close: { alignSelf: 'flex-end' },
});
