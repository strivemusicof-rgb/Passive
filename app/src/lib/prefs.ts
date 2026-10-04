import * as SecureStore from 'expo-secure-store';

/** Small device preferences (not secrets), stored on the phone. */
export const prefs = {
  get: (key: string) => SecureStore.getItemAsync(`landrush.pref.${key}`).catch(() => null),
  set: (key: string, value: string) => SecureStore.setItemAsync(`landrush.pref.${key}`, value).catch(() => {}),
};
