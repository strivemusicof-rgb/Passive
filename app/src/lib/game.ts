import type { PlotDto, WalletDto } from '@landrush/shared';
import { useEffect, useSyncExternalStore } from 'react';

import { api } from './api';

/** Player's wallet and plots, shared by every screen (same pattern as auth). */
type State = {
  wallet: WalletDto | null;
  myPlots: PlotDto[] | null;
  /** Bumped after any change to plots, so the map knows to reload. */
  version: number;
};

let state: State = { wallet: null, myPlots: null, version: 0 };
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function addPlot(plot: PlotDto) {
  const others = (state.myPlots ?? []).filter((p) => p.key !== plot.key);
  return [plot, ...others];
}

export const game = {
  load: async () => {
    const [wallet, myPlots] = await Promise.all([api.wallet(), api.myPlots()]);
    set({ wallet, myPlots });
  },
  buy: async (key: string) => {
    const res = await api.buyPlot(key);
    set({ wallet: res.wallet, myPlots: addPlot(res.plot), version: state.version + 1 });
    return res.plot;
  },
  claimStarter: async (lat: number, lng: number) => {
    const res = await api.claimStarter(lat, lng);
    set({ wallet: res.wallet, myPlots: addPlot(res.plot), version: state.version + 1 });
    return res.plot;
  },
  /** Forget everything (sign out / account deleted). */
  reset: () => set({ wallet: null, myPlots: null, version: state.version + 1 }),
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Loads wallet + plots the first time a screen needs them. */
export function useGame() {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    if (!state.wallet) game.load().catch(() => {});
  }, []);
  return snapshot;
}

/** Total income per hour from the player's plots (one decimal below 10, e.g. 0.4). */
export function incomePerHour(plots: PlotDto[] | null) {
  const perHour = (plots ?? []).reduce((sum, p) => sum + p.incomePerDay, 0) / 24;
  return perHour < 10 ? Math.round(perHour * 10) / 10 : Math.round(perHour);
}
