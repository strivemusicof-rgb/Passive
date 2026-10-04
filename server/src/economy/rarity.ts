import { RARITIES, type Rarity } from '@landrush/shared';
import { cellCenter, distanceM, type Cell } from '@landrush/shared/grid';
import { randomInt } from 'node:crypto';

import type { Economy } from './economy.service.js';

export type Odds = Record<Rarity, number>;

/** Strongest landmark boost at this cell, fading linearly to 0 at the landmark's edge. */
export function hotspotBoost(cell: Cell, economy: Pick<Economy, 'hotspots'>): number {
  const at = cellCenter(cell);
  let boost = 0;
  for (const h of economy.hotspots) {
    const d = distanceM(at, h);
    if (d < h.radiusM) boost = Math.max(boost, h.boost * (1 - d / h.radiusM));
  }
  return boost;
}

/**
 * Chance of each rarity when a plot is bought at this cell. The base weights
 * split [0, 1) into bands from common to legendary; a landmark boost k bends a
 * uniform roll u into 1 − (1 − u)^(1 + k), pushing it towards the rare end.
 * The odds below are exact for that bent roll, so what players see is what
 * `rollRarity` does.
 */
export function rarityOdds(cell: Cell, economy: Pick<Economy, 'hotspots' | 'rarityWeights'>): Odds {
  const k = hotspotBoost(cell, economy);
  const total = RARITIES.reduce((sum, r) => sum + economy.rarityWeights[r], 0);
  // Inverse of the bend: the raw roll that lands exactly on band edge x.
  const raw = (x: number) => 1 - (1 - x) ** (1 / (1 + k));
  const odds = {} as Odds;
  let edge = 0;
  for (const r of RARITIES) {
    const next = Math.min(1, edge + economy.rarityWeights[r] / total);
    odds[r] = raw(next) - raw(edge);
    edge = next;
  }
  return odds;
}

/** Picks a rarity using `odds`. `random` returns a number in [0, 1). */
export function rollRarity(odds: Odds, random: () => number = secureRandom): Rarity {
  const u = random();
  let acc = 0;
  for (const r of RARITIES) {
    acc += odds[r];
    if (u < acc) return r;
  }
  return 'common'; // only reachable through float rounding at u ≈ 1
}

function secureRandom() {
  return randomInt(0, 2 ** 32) / 2 ** 32;
}

/** Every free plot costs the same; each plot you already own adds plotPriceGrowth. */
export function plotPrice(ownedCount: number, economy: Pick<Economy, 'plotBasePrice' | 'plotPriceGrowth'>) {
  return Math.round(economy.plotBasePrice * (1 + economy.plotPriceGrowth * ownedCount));
}

type BuildingEconomy = Pick<Economy, 'buildingIncome' | 'buildingCost' | 'buildingRarity'>;

/** Extra coins/day a building of `level` gives on land of this rarity. */
export function buildingIncome(rarity: Rarity, level: number, economy: BuildingEconomy): number {
  return Math.round((economy.buildingIncome[level] ?? 0) * (economy.buildingRarity[rarity]?.income ?? 1));
}

/** Coins to build/upgrade to `level` on land of this rarity (rounded to 10). */
export function buildingCost(rarity: Rarity, level: number, economy: BuildingEconomy): number {
  return Math.round(((economy.buildingCost[level] ?? 0) * (economy.buildingRarity[rarity]?.cost ?? 1)) / 10) * 10;
}

export function plotIncome(rarity: Rarity, buildingLevel: number, economy: Pick<Economy, 'rarityIncome'> & BuildingEconomy) {
  return economy.rarityIncome[rarity] + buildingIncome(rarity, buildingLevel, economy);
}

/**
 * What a plot is worth, for marketplace price limits: about three days of its
 * land income plus what its buildings cost.
 */
export function plotValue(
  rarity: Rarity,
  buildingLevel: number,
  economy: Pick<Economy, 'rarityIncome'> & BuildingEconomy,
): number {
  let value = economy.rarityIncome[rarity] * 3;
  for (let level = 1; level <= buildingLevel; level++) value += buildingCost(rarity, level, economy);
  return value;
}

export function priceRange(value: number, economy: Pick<Economy, 'market'>) {
  return {
    min: Math.max(1, Math.ceil(value * economy.market.minPriceFactor)),
    max: Math.floor(value * economy.market.maxPriceFactor),
  };
}
