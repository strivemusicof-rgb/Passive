import { Injectable } from '@nestjs/common';
import type { Rarity } from '@landrush/shared';

import { PrismaService } from '../prisma/prisma.service.js';

export type Hotspot = { name: string; lat: number; lng: number; radiusM: number; boost: number };

/**
 * Every game-balance number. Rows in `economy_config` (key → JSON value)
 * override these defaults, so balance can change without an app update.
 */
export const ECONOMY_DEFAULTS = {
  welcomeCoins: 1000,
  welcomeGems: 20,
  /** Price of any free plot for a player who owns none (rarity is rolled on purchase). */
  plotBasePrice: 150,
  /** Each plot you already own makes the next one this much dearer (0.05 = +5%). */
  plotPriceGrowth: 0.05,
  /** Relative chance of each rarity when a plot is bought (landmarks improve it). */
  rarityWeights: { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 } as Record<Rarity, number>,
  /** Coins per day an empty plot earns, by rarity. */
  rarityIncome: { common: 3, uncommon: 6, rare: 12, epic: 25, legendary: 50 } as Record<Rarity, number>,
  /** Extra coins per day by building level (0 = empty, 1 house … 4 tower). */
  buildingIncome: [0, 3, 10, 30, 100],
  /** Landmarks where buying gives better rarity odds. */
  hotspots: [
    { name: 'Riga Old Town', lat: 56.9488, lng: 24.1064, radiusM: 700, boost: 1.0 },
    { name: 'Freedom Monument', lat: 56.9514, lng: 24.1133, radiusM: 200, boost: 1.5 },
    { name: 'Jūrmala beach', lat: 56.9726, lng: 23.7836, radiusM: 2000, boost: 0.6 },
    { name: 'Tallinn Old Town', lat: 59.4372, lng: 24.7454, radiusM: 700, boost: 1.0 },
    { name: 'Vilnius Old Town', lat: 54.6812, lng: 25.2873, radiusM: 800, boost: 1.0 },
  ] as Hotspot[],
};

export type Economy = typeof ECONOMY_DEFAULTS;

const CACHE_MS = 30_000;

@Injectable()
export class EconomyService {
  private cache: { value: Economy; at: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<Economy> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.value;
    const rows = await this.prisma.economyConfig.findMany();
    const value = { ...ECONOMY_DEFAULTS } as Record<string, unknown>;
    for (const row of rows) if (row.key in ECONOMY_DEFAULTS) value[row.key] = row.value;
    this.cache = { value: value as Economy, at: Date.now() };
    return this.cache.value;
  }

  /** Drop the cache (tests, admin changes). */
  invalidate() {
    this.cache = null;
  }
}
