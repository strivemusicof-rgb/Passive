import type {
  AchievementDto,
  DailyRewardDto,
  IncomeDto,
  MissionsResponse,
  PlotDto,
  RewardResponse,
  RewardsDto,
  WalletDto,
} from '@landrush/shared';
import { useEffect, useSyncExternalStore } from 'react';

import { api } from './api';
import { auth } from './auth';
import { scheduleStorageFull } from './notifications';

/** Player's wallet, plots and income, shared by every screen (same pattern as auth). */
type State = {
  wallet: WalletDto | null;
  myPlots: PlotDto[] | null;
  income: IncomeDto | null;
  /** Local time when `income` arrived, to count pending coins up between refreshes. */
  incomeAt: number;
  missions: MissionsResponse | null;
  daily: DailyRewardDto | null;
  achievements: AchievementDto[] | null;
  rewards: RewardsDto | null;
  /** Bumped after any change to plots, so the map knows to reload. */
  version: number;
};

const EMPTY: State = {
  wallet: null,
  myPlots: null,
  income: null,
  incomeAt: 0,
  missions: null,
  daily: null,
  achievements: null,
  rewards: null,
  version: 0,
};
let state: State = EMPTY;
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  if (patch.income !== undefined) scheduleStorageFull(patch.income?.fullAt ?? null);
  listeners.forEach((l) => l());
}

/** After any action: missions/achievements may have moved; XP may have changed. */
function refreshProgress() {
  api.missions().then((missions) => set({ missions })).catch(() => {});
  api.rewards().then((rewards) => set({ rewards })).catch(() => {});
  api.achievements().then((achievements) => set({ achievements })).catch(() => {});
  auth.refreshUser().catch(() => {});
}

function applyReward(res: RewardResponse) {
  set({ wallet: res.wallet });
  auth.setUser(res.user);
  refreshProgress();
  return res;
}

function withPlot(plot: PlotDto) {
  return [plot, ...(state.myPlots ?? []).filter((p) => p.key !== plot.key)];
}

let loading: Promise<void> | null = null;
/** True once everything has been fetched (claiming the starter plot fills only the wallet). */
let loaded = false;

export const game = {
  snapshot: () => state,
  load: () =>
    (loading ??= (async () => {
      try {
        const [wallet, myPlots, income, missions, daily] = await Promise.all([
          api.wallet(),
          api.myPlots(),
          api.income(),
          api.missions(),
          api.daily(),
        ]);
        loaded = true;
        set({ wallet, myPlots, income, incomeAt: Date.now(), missions, daily });
        api.achievements().then((achievements) => set({ achievements })).catch(() => {});
        api.rewards().then((rewards) => set({ rewards })).catch(() => {});
      } finally {
        loading = null;
      }
    })()),
  /** Neighbour bonuses change other plots' income too, so reload the list after buying. */
  buy: async (key: string) => {
    const res = await api.buyPlot(key);
    set({ wallet: res.wallet, myPlots: withPlot(res.plot), income: res.income, incomeAt: Date.now(), version: state.version + 1 });
    api.myPlots().then((myPlots) => set({ myPlots })).catch(() => {});
    refreshProgress();
    return res.plot;
  },
  claimStarter: async (lat: number, lng: number) => {
    const res = await api.claimStarter(lat, lng);
    set({ wallet: res.wallet, myPlots: withPlot(res.plot), income: res.income, incomeAt: Date.now(), version: state.version + 1 });
    return res.plot;
  },
  collect: async () => {
    const res = await api.collect();
    set({ wallet: res.wallet, income: res.income, incomeAt: Date.now() });
    if (res.collected > 0) refreshProgress();
    return res;
  },
  upgrade: async (key: string) => {
    const res = await api.upgradePlot(key);
    set({ wallet: res.wallet, myPlots: withPlot(res.plot), income: res.income, incomeAt: Date.now(), version: state.version + 1 });
    refreshProgress();
    return res.plot;
  },
  upgradeStorage: async () => {
    const res = await api.upgradeStorage();
    set({ wallet: res.wallet, income: res.income, incomeAt: Date.now() });
  },
  claimMission: async (scope: 'daily' | 'weekly', key: string) => applyReward(await api.claimMission(scope, key)),
  claimDaily: async () => {
    const res = await api.claimDaily();
    set({ daily: res.daily });
    return applyReward(res);
  },
  checkIn: async (key: string, lat: number, lng: number) => applyReward(await api.checkIn(key, lat, lng)),
  loadRewards: async () => set({ rewards: await api.rewards() }),
  cashout: async (method: string, destination: string) => {
    const rewards = await api.cashout(method, destination);
    set({ rewards, wallet: state.wallet ? { ...state.wallet, points: rewards.points } : state.wallet });
  },
  /** Forget everything (sign out / account deleted). */
  reset: () => {
    loaded = false;
    scheduleStorageFull(null);
    set({ ...EMPTY, version: state.version + 1 });
  },
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Loads wallet + plots + income the first time a screen needs them. */
export function useGame() {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    if (!loaded) game.load().catch(() => {});
  }, []);
  return snapshot;
}

/**
 * Coins waiting right now, counted up locally from the last server snapshot
 * (display only: the server decides the real amount on Collect).
 */
export function estimatePending(income: IncomeDto | null, incomeAt: number, now: number): { coins: number; full: boolean } {
  if (!income || !income.fullAt) return { coins: 0, full: false };
  const full = now - incomeAt >= new Date(income.fullAt).getTime() - new Date(income.serverTime).getTime();
  const elapsedH = Math.max(0, now - incomeAt) / 3_600_000;
  const maxCoins = (income.perDay / 24) * income.storageHours;
  return { coins: Math.floor(Math.min(income.pending + (income.perDay / 24) * elapsedH, maxCoins)), full };
}

/** Income per hour (one decimal below 10, e.g. 2.5). */
export function perHour(perDay: number) {
  const h = perDay / 24;
  return h < 10 ? Math.round(h * 10) / 10 : Math.round(h);
}
