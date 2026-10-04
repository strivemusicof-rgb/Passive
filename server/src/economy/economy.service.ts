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
  /** Coins per day an empty plot earns, by rarity (common pays back its price in ~3 days). */
  rarityIncome: { common: 48, uncommon: 72, rare: 120, epic: 192, legendary: 360 } as Record<Rarity, number>,
  /** Extra coins per day by building level (0 = empty, 1 house, 2 office, 3 hotel, 4 tower). */
  buildingIncome: [0, 48, 168, 480, 1440],
  /** Coins to build/upgrade TO each level (index 1 = house). Each pays back in ~10–28 days. */
  buildingCost: [0, 500, 2500, 10000, 40000],
  /**
   * Rarer land gets more from its buildings, and building there costs more.
   * Income grows faster than cost, so rare land pays back sooner.
   */
  buildingRarity: {
    common: { income: 1, cost: 1 },
    uncommon: { income: 1.3, cost: 1.2 },
    rare: { income: 1.7, cost: 1.45 },
    epic: { income: 2.3, cost: 1.8 },
    legendary: { income: 3.2, cost: 2.3 },
  } as Record<Rarity, { income: number; cost: number }>,
  /** Income bonus for each of the 8 surrounding plots you also own (0.05 = +5%, max +40%). */
  neighbourBonus: 0.05,
  /** Hours a plot keeps earning before it must be collected, by storage level. */
  storageHours: [8, 12, 16, 24],
  /** Coins to upgrade storage TO each level. */
  storageCost: [0, 2000, 6000, 15000],
  /** Missions per period. `event` is what counts towards `target`. */
  missions: {
    daily: [
      { key: 'login', event: 'login', target: 1, coins: 50, gems: 0, xp: 5 },
      { key: 'collect', event: 'collect', target: 1, coins: 50, gems: 0, xp: 10 },
      { key: 'buyPlot', event: 'buyPlot', target: 1, coins: 100, gems: 0, xp: 20 },
      { key: 'upgrade', event: 'upgrade', target: 1, coins: 100, gems: 0, xp: 20 },
      { key: 'checkIn', event: 'checkIn', target: 1, coins: 80, gems: 0, xp: 15 },
    ] as MissionDef[],
    weekly: [
      { key: 'collect10', event: 'collect', target: 10, coins: 600, gems: 5, xp: 100 },
      { key: 'buyPlot3', event: 'buyPlot', target: 3, coins: 800, gems: 5, xp: 120 },
      { key: 'upgrade3', event: 'upgrade', target: 3, coins: 1000, gems: 10, xp: 150 },
      { key: 'checkIn5', event: 'checkIn', target: 5, coins: 800, gems: 10, xp: 120 },
    ] as MissionDef[],
  },
  /** 7-day login streak rewards (day 1 … day 7, then it starts over). */
  dailyRewards: [
    { coins: 100, gems: 0 },
    { coins: 150, gems: 0 },
    { coins: 0, gems: 5 },
    { coins: 300, gems: 0 },
    { coins: 0, gems: 10 },
    { coins: 500, gems: 0 },
    { coins: 1000, gems: 25 },
  ],
  /** XP for actions (missions have their own XP). */
  xpFor: { buyPlot: 10, upgrade: 25, checkIn: 15, dailyReward: 5 },
  /** Gems for every level gained. */
  levelUpGems: 5,
  /** Standing at your own plot: once per plot per day. */
  checkIn: { radiusM: 100, rewardShare: 0.25, maxPerDay: 10 },
  /**
   * ⭐ reward points: the only currency that can be cashed out. Land income
   * turns into points, so coins/plots/income must NEVER be sold for real
   * money (no coin packs, no paid boosts; cosmetics only). Daily caps keep
   * payouts below ad income. `enabled` is the public switch; `testers`
   * (user ids or emails) get it early.
   */
  rewards: {
    enabled: false,
    testers: [] as string[],
    pointsPerEuro: 1000,
    minCashoutPoints: 5000,
    minAccountAgeDays: 7,
    /** Total ⭐ per day from free play (everything in `earn`) at level 1 … */
    dailyCap: 150,
    /** … plus this much per level above 1 … */
    dailyCapPerLevel: 10,
    /** … up to this. Long-term players can earn more; bots rarely level up. */
    dailyCapMax: 400,
    earn: {
      checkIn: 5,
      streakDay7: 50,
      weeklyMission: 20,
      levelUp: 25,
      /** Collecting land income: 1 ⭐ per this many coins collected … */
      landCoinsPerPoint: 50,
      /** … up to this many ⭐ a day from land (at level 1) … */
      landDailyCap: 60,
      /** … plus this much per level above 1, up to landDailyCapMax. */
      landDailyCapPerLevel: 5,
      landDailyCapMax: 250,
    },
    methods: ['paypal', 'giftcard'],
  },
  /**
   * Rewarded video ads (AdMob). Ads pay us, so their ⭐ don't count towards
   * the free-play cap (they have their own: perAd × maxPerDay). Set
   * `requireSsv` to true once the real AdMob ad unit has the server-side
   * verification URL set; until then (Google's test ads) the app's word is
   * trusted, which is fine because test ads give nothing of real value.
   */
  ads: {
    enabled: true,
    requireSsv: false,
    /** Rewarded ads a player can watch per day (all placements together). */
    maxPerDay: 20,
    /** Seconds between two rewarded ads. */
    cooldownSec: 30,
    /** Watch after collecting: get the same coins again (up to maxCoins). */
    collect2x: { maxCoins: 5000, withinMinutes: 15 },
    /** Watch for a small bonus. */
    bonus: { coins: 100, points: 5 },
  },
  /**
   * Player-to-player plot trading. Prices must stay within min…max × the
   * plot's value (stops coins being moved between a player's own accounts);
   * the fee leaves the game (coin sink).
   */
  market: {
    feeRate: 0.05,
    minPriceFactor: 0.5,
    maxPriceFactor: 20,
    /** Account age before you can list a plot. */
    minAccountAgeDays: 2,
    maxActiveListings: 20,
    maxBuysPerDay: 10,
  },
  /**
   * Leaderboards. The monthly board ranks coins collected from land this
   * month; when a month ends its top players get these gems (index 0 = 1st).
   */
  leaderboard: {
    size: 50,
    monthlyPrizeGems: [100, 60, 40, 20, 20, 10, 10, 10, 10, 10],
    /** "Near you": plots within this many degrees of your newest plot (~11 km). */
    nearDeg: 0.1,
  },
  /** Landmarks where buying gives better rarity odds. */
  hotspots: [
    { name: 'Riga Old Town', lat: 56.9488, lng: 24.1064, radiusM: 700, boost: 1.0 },
    { name: 'Freedom Monument', lat: 56.9514, lng: 24.1133, radiusM: 200, boost: 1.5 },
    { name: 'Jūrmala beach', lat: 56.9726, lng: 23.7836, radiusM: 2000, boost: 0.6 },
    { name: 'Tallinn Old Town', lat: 59.4372, lng: 24.7454, radiusM: 700, boost: 1.0 },
    { name: 'Vilnius Old Town', lat: 54.6812, lng: 25.2873, radiusM: 800, boost: 1.0 },
  ] as Hotspot[],
};

export type MissionEvent = 'login' | 'collect' | 'buyPlot' | 'upgrade' | 'checkIn';
export type MissionDef = { key: string; event: MissionEvent; target: number; coins: number; gems: number; xp: number };

export type Economy = typeof ECONOMY_DEFAULTS;

const CACHE_MS = 30_000;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function merge(base: unknown, over: unknown): unknown {
  if (!isObject(base) || !isObject(over)) return over;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = merge(base[k], v);
  return out;
}

/** Free-play ⭐ limits for a player's level. */
export function pointCaps(rewards: Economy['rewards'], level: number) {
  const up = Math.max(0, level - 1);
  return {
    daily: Math.min(rewards.dailyCapMax, rewards.dailyCap + rewards.dailyCapPerLevel * up),
    land: Math.min(rewards.earn.landDailyCapMax, rewards.earn.landDailyCap + rewards.earn.landDailyCapPerLevel * up),
  };
}

@Injectable()
export class EconomyService {
  private cache: { value: Economy; at: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<Economy> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.value;
    const rows = await this.prisma.economyConfig.findMany();
    const value = { ...ECONOMY_DEFAULTS } as Record<string, unknown>;
    // Objects are merged over the defaults, so a saved row from an older
    // version still gets settings that were added later.
    for (const row of rows) if (row.key in ECONOMY_DEFAULTS) value[row.key] = merge(value[row.key], row.value);
    this.cache = { value: value as Economy, at: Date.now() };
    return this.cache.value;
  }

  /** Drop the cache (tests, admin changes). */
  invalidate() {
    this.cache = null;
  }
}
