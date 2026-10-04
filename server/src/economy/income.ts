import type { Rarity } from '@landrush/shared';

import type { Economy } from './economy.service.js';
import { plotIncome } from './rarity.js';

const HOUR_MS = 3_600_000;

export type IncomePlot = { rarity: Rarity; buildingLevel: number; collectedAt: Date; neighbours: number };

/** Coins per day for one plot, including the bonus for owned neighbours. */
export function plotIncomePerDay(p: Omit<IncomePlot, 'collectedAt'>, economy: Economy): number {
  const bonus = 1 + economy.neighbourBonus * Math.min(p.neighbours, 8);
  return Math.round(plotIncome(p.rarity, p.buildingLevel, economy) * bonus);
}

export function storageHoursFor(level: number, economy: Economy): number {
  return economy.storageHours[Math.min(level, economy.storageHours.length - 1)];
}

/**
 * Coins waiting to be collected. Each plot earns from its own collectedAt,
 * but never more than `storageHours` worth. Fractions are kept until the
 * total is summed, then rounded down.
 */
export function pendingCoins(plots: IncomePlot[], storageHours: number, now: Date, economy: Economy): number {
  let total = 0;
  for (const p of plots) {
    const hours = Math.min(Math.max(0, (now.getTime() - p.collectedAt.getTime()) / HOUR_MS), storageHours);
    total += (plotIncomePerDay(p, economy) / 24) * hours;
  }
  return Math.floor(total + 1e-9);
}

/** When every plot will be full (null if the player owns nothing). */
export function storageFullAt(plots: IncomePlot[], storageHours: number): Date | null {
  if (plots.length === 0) return null;
  const latest = Math.max(...plots.map((p) => p.collectedAt.getTime()));
  return new Date(latest + storageHours * HOUR_MS);
}
