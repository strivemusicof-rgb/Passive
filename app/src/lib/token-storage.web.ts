// Web preview only: the browser has no Keychain, so use localStorage.
const KEY = 'landrush.refreshToken';

export const tokenStorage = {
  get: async () => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set: async (token: string) => {
    try {
      localStorage.setItem(KEY, token);
    } catch {}
  },
  clear: async () => {
    try {
      localStorage.removeItem(KEY);
    } catch {}
  },
};
