import * as SecureStore from 'expo-secure-store';

const KEY = 'landrush.refreshToken';

/** Refresh token lives in the iOS Keychain. */
export const tokenStorage = {
  get: () => SecureStore.getItemAsync(KEY),
  set: (token: string) => SecureStore.setItemAsync(KEY, token),
  clear: () => SecureStore.deleteItemAsync(KEY),
};
