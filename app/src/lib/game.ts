import type { IncomeDto, PlotDto, WalletDto } from '@landrush/shared';
import { useEffect, useSyncExternalStore } from 'react';

import { api } from './api';

/** Player's wallet, plots and income, shared by every screen (same pattern as auth). */
type State = {
  wallet: WalletDto | null;
  myPlots: PlotDto[] | null;
  income: IncomeDto | null;
  /** Local time when `income` arrived, to count pending coins up between refreshes. */
  incomeAt: number;
  /** Bumped after any change to plots, so the map knows to reload. */
  version: number;
};

let state: State = { wallet: null, myPlots: null, income: null, incomeAt: 0, version: 0 };
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function withPlot(plot: PlotDto) {
  return [plot, ...(state.myPlots ?? []).filter((p) => p.key !== plot.key)];
}

let loading: Promise<void> | null = null;

export const game = {
  load: () =>
    (loading ??= (async () => {
      try {
        const [wallet, myPlots, income] = await Promise.all([api.wallet(), api.myPlots(), api.income()]);
        set({ wallet, myPlots, income, incomeAt: Date.now() });
      } finally {
        loading = null;
      }
    })()),
  /** Neighbour bonuses change other plots' income too, so reload the list after buying. */
  buy: async (key: string) => {
    const res = await api.buyPlot(key);
    set({ wallet: res.wallet, myPlots: withPlot(res.plot), income: res.income, incomeAt: Date.now(), version: state.version + 1 });
    api.myPlots().then((myPlots) => set({ myPlots })).catch(() => {});
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
    return res.collected;
  },
  upgrade: async (key: string) => {
    const res = await api.upgradePlot(key);
    set({ wallet: res.wallet, myPlots: withPlot(res.plot), income: res.income, incomeAt: Date.now(), version: state.version + 1 });
    return res.plot;
  },
  upgradeStorage: async () => {
    const res = await api.upgradeStorage();
    set({ wallet: res.wallet, income: res.income, incomeAt: Date.now() });
  },
  /** Forget everything (sign out / account deleted). */
  reset: () => set({ wallet: null, myPlots: null, income: null, incomeAt: 0, version: state.version + 1 }),
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Loads wallet + plots + income the first time a screen needs them. */
export function useGame() {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    if (!state.wallet) game.load().catch(() => {});
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
