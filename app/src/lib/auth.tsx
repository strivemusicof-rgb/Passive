import type { AuthResponse, Language, UserDto } from '@landrush/shared';
import { useSyncExternalStore } from 'react';

import i18n from '@/i18n';

import { api, ApiError, setSession } from './api';
import { game } from './game';
import { tokenStorage } from './token-storage';

/**
 * Login state lives outside React in a tiny store, so the API client can
 * refresh tokens without depending on component lifecycles.
 */
type State = {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: UserDto | null;
  /** True right after an account was created on this device (show the tutorial). */
  isNewAccount: boolean;
};

const NEW_ACCOUNT_MS = 60_000;

let state: State = { status: 'loading', user: null, isNewAccount: false };
let refreshToken: string | null = null;
let refreshing: Promise<string | null> | null = null;
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

async function apply(res: AuthResponse, isNewAccount = state.isNewAccount) {
  refreshToken = res.refreshToken;
  setSession(res.accessToken, refresh);
  await tokenStorage.set(res.refreshToken);
  // One update, so screens never see "signed in" without knowing if it's a new account.
  set({ status: 'signedIn', user: res.user, isNewAccount });
}

async function clear() {
  refreshToken = null;
  setSession(null, null);
  await tokenStorage.clear();
  game.reset();
  set({ status: 'signedOut', user: null, isNewAccount: false });
}

/** Exchanges the refresh token for a new access token (one request at a time). */
function refresh(): Promise<string | null> {
  refreshing ??= (async () => {
    const token = refreshToken;
    if (!token) return null;
    try {
      const res = await api.refresh(token);
      await apply(res);
      return res.accessToken;
    } catch (e) {
      // Only a rejected token signs the player out; network errors keep the session.
      if (e instanceof ApiError && e.status === 401) await clear();
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** After sign-in: new accounts take the device language, old ones restore theirs. */
async function signedIn(res: AuthResponse) {
  if (state.user && state.user.id !== res.user.id) game.reset();
  const isNew = Date.now() - new Date(res.user.createdAt).getTime() < NEW_ACCOUNT_MS;
  await apply(res, isNew);
  const deviceLang = i18n.language as Language;
  if (res.user.language === deviceLang) return;
  if (isNew) set({ user: await api.updateMe({ language: deviceLang }).catch(() => res.user) });
  else await i18n.changeLanguage(res.user.language);
}

/** Restores the saved login once at app start. */
async function restore() {
  const stored = await tokenStorage.get();
  if (!stored) return set({ status: 'signedOut' });
  refreshToken = stored;
  try {
    const res = await api.refresh(stored);
    await apply(res);
    if (res.user.language !== i18n.language) await i18n.changeLanguage(res.user.language);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) await clear();
    else set({ status: 'signedOut' }); // offline: show login; the token stays for next launch
  }
}

let restoring: Promise<void> | null = null;

export const auth = {
  start: () => (restoring ??= restore()),
  /** Rewards return the updated player (XP, level). */
  setUser: (user: UserDto) => set({ user }),
  refreshUser: async () => set({ user: await api.me() }),
  signInGuest: async () => signedIn(await api.guest()),
  signInApple: async (identityToken: string) => signedIn(await api.apple(identityToken)),
  signInEmail: async (email: string, password: string, mode: 'login' | 'register') =>
    signedIn(await (mode === 'login' ? api.login(email, password) : api.register(email, password))),
  updateProfile: async (data: { displayName?: string; language?: Language }) => {
    set({ user: await api.updateMe(data) });
  },
  signOut: async () => {
    if (refreshToken) await api.logout(refreshToken).catch(() => {});
    await clear();
  },
  deleteAccount: async () => {
    await api.deleteMe();
    await clear();
  },
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAuth() {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  return { ...snapshot, ...auth };
}
