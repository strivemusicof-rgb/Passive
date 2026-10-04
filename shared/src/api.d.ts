import type { Language } from './index.js';

/** Public view of the signed-in player (GET /me). */
export interface UserDto {
  id: string;
  displayName: string;
  isGuest: boolean;
  hasApple: boolean;
  hasEmail: boolean;
  language: Language;
  level: number;
  xp: number;
  /** XP inside the current level, and how much the level takes in total. */
  levelXp: { current: number; needed: number };
  createdAt: string;
}

export interface AuthResponse {
  user: UserDto;
  /** Short-lived JWT, send as `Authorization: Bearer <token>`. */
  accessToken: string;
  /** Long-lived opaque token; store securely, exchange at POST /auth/refresh. */
  refreshToken: string;
}

/** Machine-readable error codes the app translates for the player. */
export type ApiErrorCode =
  | 'invalid_credentials'
  | 'email_taken'
  | 'name_taken'
  | 'invalid_apple_token'
  | 'invalid_refresh_token'
  | 'unauthorized'
  | 'validation_failed'
  | 'too_many_requests'
  | 'plot_taken'
  | 'insufficient_funds'
  | 'starter_already_claimed'
  | 'no_free_plot_nearby'
  | 'invalid_plot'
  | 'area_too_large'
  | 'not_your_plot'
  | 'max_level'
  | 'already_claimed'
  | 'not_complete'
  | 'already_checked_in'
  | 'too_far'
  | 'check_in_limit'
  | 'rewards_disabled'
  | 'guest_cannot_cashout'
  | 'account_too_new'
  | 'not_enough_points'
  | 'cashout_pending'
  | 'invalid_destination';

export interface WalletDto {
  coins: number;
  gems: number;
  /** ⭐ reward points: earned for free only; the one currency that can be cashed out. */
  points: number;
}

/** One grid cell, owned or free. `key` is "row_col". */
export interface PlotDto {
  key: string;
  row: number;
  col: number;
  /** Public "#8472" number; null for free plots. */
  number: number | null;
  lat: number;
  lng: number;
  /** Rolled when the plot is bought; null while it's free. */
  rarity: import('./index.js').Rarity | null;
  /** Free plots: chance (0–1) of each rarity when bought here. Shown before buying. */
  odds: Record<import('./index.js').Rarity, number> | null;
  /** Free plot near a landmark, with better odds. */
  boosted: boolean;
  owner: { id: string; displayName: string } | null;
  mine: boolean;
  buildingLevel: number;
  /** Owned plots only (free plots earn nothing until bought). Includes the neighbour bonus. */
  incomePerDay: number;
  /** Owned plots: how many of the 8 surrounding plots the same owner has. */
  neighbours: number;
  /** Your own plots: cost and new income/day of the next building level; null at max level. */
  nextLevel: { level: number; cost: number; incomePerDay: number } | null;
  /** What it costs the viewer to buy it now; null if it's owned. */
  price: number | null;
  name: string | null;
}

export interface MapPlotsResponse {
  owned: PlotDto[];
  /** Free cells, only sent when the map is zoomed in enough. */
  free: PlotDto[];
}

export interface BuyPlotResponse {
  plot: PlotDto;
  wallet: WalletDto;
  income: IncomeDto;
}

/** The player's income state (GET /me/income). */
export interface IncomeDto {
  /** Sum of all plots' income, per day. */
  perDay: number;
  /** Coins waiting right now (server-calculated). */
  pending: number;
  storageLevel: number;
  storageHours: number;
  /** When storage is completely full; null with no plots. */
  fullAt: string | null;
  /** Server time of this snapshot, for client-side counting between refreshes. */
  serverTime: string;
  nextStorage: { level: number; hours: number; cost: number } | null;
  /** Price list for the building screen (index = level). */
  buildingCost: number[];
  buildingIncome: number[];
}

export interface CollectResponse {
  collected: number;
  /** ⭐ reward points this collect turned into (0 if rewards are off or capped). */
  points: number;
  wallet: WalletDto;
  income: IncomeDto;
}

export interface UpgradeResponse {
  plot: PlotDto;
  wallet: WalletDto;
  income: IncomeDto;
}

export interface MissionDto {
  key: string;
  progress: number;
  target: number;
  claimed: boolean;
  coins: number;
  gems: number;
  xp: number;
}

export interface MissionsResponse {
  daily: MissionDto[];
  weekly: MissionDto[];
  /** ISO times of the next resets (Riga midnight / Monday). */
  dailyResetsAt: string;
  weeklyResetsAt: string;
}

export interface DailyRewardDto {
  /** The streak day the next claim gives (1–7). */
  nextDay: number;
  claimedToday: boolean;
  /** Day claimed most recently (0 = none yet). */
  streakDay: number;
  rewards: { coins: number; gems: number }[];
}

/** Returned by every claim/check-in: what changed. */
export interface RewardResponse {
  coins: number;
  gems: number;
  /** ⭐ reward points given (0 when rewards are off or today's cap is reached). */
  points: number;
  xp: number;
  leveledUp: boolean;
  wallet: WalletDto;
  user: UserDto;
}

export interface AchievementDto {
  key: string;
  unlocked: boolean;
  progress: number;
  target: number;
}

export type CashoutStatus = 'pending' | 'approved' | 'paid' | 'rejected';

export interface CashoutRequestDto {
  id: string;
  points: number;
  eurCents: number;
  method: string;
  destination: string;
  status: CashoutStatus;
  note: string | null;
  createdAt: string;
}

/** GET /rewards: everything the Rewards screen needs. */
export interface RewardsDto {
  /** False until rewards are switched on (or the player is a tester). */
  enabled: boolean;
  points: number;
  pointsPerEuro: number;
  minCashoutPoints: number;
  /** Points earned today from free play, and the daily limit. */
  todayEarned: number;
  /** Of which from collecting land income (limited by earn.landDailyCap). */
  todayLand: number;
  /** From rewarded ads today (not part of the free-play limit). */
  todayAds: number;
  /** Free-play limit for the player's level, and the next level's (null at the top). */
  dailyCap: number;
  nextLevelDailyCap: number | null;
  earn: {
    checkIn: number;
    streakDay7: number;
    weeklyMission: number;
    levelUp: number;
    landCoinsPerPoint: number;
    landDailyCap: number;
    /** ⭐ per bonus ad and how many ads a day (0 = ads off). */
    perAd: number;
    adsPerDay: number;
  };
  methods: string[];
  /** Why cash-out isn't possible yet (null = it is). */
  cashoutBlocked: 'rewards_disabled' | 'guest_cannot_cashout' | 'account_too_new' | 'not_enough_points' | 'cashout_pending' | null;
  /** Recent point changes, newest first. */
  history: { amount: number; type: string; createdAt: string }[];
  requests: CashoutRequestDto[];
}

// ------------------------------------------------------------ rewarded ads

export type AdPlacement = 'collect2x' | 'bonus';

/** GET /ads: what the player can watch now. */
export interface AdsDto {
  enabled: boolean;
  remainingToday: number;
  maxPerDay: number;
  /** Next ad allowed from this time (null = now). */
  cooldownUntil: string | null;
  /** Coins a 2× ad would give for the latest collect (null = nothing to double). */
  collect2x: { coins: number } | null;
  bonus: { coins: number; points: number };
}

/** POST /ads/:id/complete. "pending" = waiting for Google to confirm; ask again shortly. */
export interface AdRewardResponse {
  status: 'rewarded' | 'pending';
  coins: number;
  points: number;
  wallet: WalletDto;
  ads: AdsDto;
}
