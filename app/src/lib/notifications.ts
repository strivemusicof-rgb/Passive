import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import i18n from '@/i18n';

// Show reminders even while the app is open.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

const STORAGE_FULL_ID = 'storage-full';

/** Asks once for permission (iOS shows its own dialog). Returns true if allowed. */
export async function allowReminders(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/**
 * Local reminder (scheduled on the phone, no push server): "your storage is
 * full". Replaces any earlier one; cancelled if there's nothing to wait for.
 */
export async function scheduleStorageFull(fullAt: string | null): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(STORAGE_FULL_ID).catch(() => {});
    if (!fullAt) return;
    const when = new Date(fullAt);
    if (when.getTime() - Date.now() < 60_000) return;
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    await Notifications.scheduleNotificationAsync({
      identifier: STORAGE_FULL_ID,
      content: { title: i18n.t('notify.fullTitle'), body: i18n.t('notify.fullBody') },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
    });
  } catch {
    // Reminders are a nice-to-have; never let them break the game.
  }
}
