// Web preview: localStorage instead of the Keychain.
export const prefs = {
  get: async (key: string) => {
    try {
      return localStorage.getItem(`landrush.pref.${key}`);
    } catch {
      return null;
    }
  },
  set: async (key: string, value: string) => {
    try {
      localStorage.setItem(`landrush.pref.${key}`, value);
    } catch {}
  },
};
