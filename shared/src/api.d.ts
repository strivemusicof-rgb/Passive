import type { Language } from './index.js';

/** Public view of the signed-in player (GET /me). */
/** How a player looks to others (equipped cosmetics, resolved to colours). */
export interface UserStyle {
  nameColor: string | null;
  frame: { color: string; accent: string | null } | null;
}

/** A player shown next to something (plot owner, seller, leaderboard row). */
export interface PlayerRef {
  id: string;
  displayName: string;
  style: UserStyle;
}

export interface UserDto {
  id: string;
  displayName: string;
  style: UserStyle;
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
  owner: PlayerRef | null;
  /** Cosmetics on owned plots: tile colour on the map, and an emoji flag. */
  skin: { id: string; color: string } | null;
  flag: { id: string; emoji: string } | null;
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
  /** On sale on the marketplace (owned plots only). */
  listing: { id: string; price: number } | null;
  /** Your own plots: cost and extra income/day of each building level on this land (index = level; rarer land = more of both). */
  buildings: { cost: number; income: number }[] | null;
  /** Your own plots: what it's worth and the allowed listing price range. */
  sale: { value: number; min: number; max: number; feeRate: number } | null;
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
  /** Base price list for common land (index = level); see PlotDto.buildings for a plot's own prices. */
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

// ------------------------------------------------------------ marketplace

export type ListingStatus = 'active' | 'sold' | 'cancelled';

export interface ListingDto {
  id: string;
  price: number;
  /** Coins the market kept (sold listings). */
  fee: number;
  status: ListingStatus;
  createdAt: string;
  closedAt: string | null;
  seller: PlayerRef;
  buyer: PlayerRef | null;
  mine: boolean;
  favourite: boolean;
  plot: PlotDto;
}

export type MarketSort = 'newest' | 'cheapest' | 'income' | 'rarity';

/** GET /market */
export interface MarketResponse {
  listings: ListingDto[];
  feeRate: number;
}

/** GET /market/mine: your listings, then your recent sales and purchases. */
export interface MyMarketResponse {
  active: ListingDto[];
  history: ListingDto[];
}

/** POST /market/:id/buy */
export interface MarketBuyResponse {
  plot: PlotDto;
  wallet: WalletDto;
  income: IncomeDto;
}

// ------------------------------------------------------------ leaderboard

/** all = land income now; month = coins collected this month; near = land income around you. */
export type LeaderboardScope = 'all' | 'month' | 'near';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  style: UserStyle;
  plots: number;
  incomePerHour: number;
  /** What the board is ranked by (income/h, or coins collected this month). */
  score: number;
}

export interface LeaderboardResponse {
  scope: LeaderboardScope;
  entries: LeaderboardEntry[];
  /** You, if you're on the board at all (also when outside the top). */
  me: LeaderboardEntry | null;
  /** Gems for 1st, 2nd, … at the end of the month. */
  monthlyPrizeGems: number[];
  monthEndsAt: string;
  /** Last month's prize winners. */
  lastWinners: { rank: number; displayName: string; gems: number }[];
}

// ------------------------------------------------------------ cosmetics

export interface CosmeticItemDto {
  id: string;
  type: import('./cosmetics.js').CosmeticType;
  value: string;
  accent: string | null;
  gems: number | null;
  coins: number | null;
  owned: boolean;
}

/** GET /cosmetics */
export interface CosmeticsResponse {
  items: CosmeticItemDto[];
  /** What you're wearing now (item ids). */
  equipped: { nameColor: string | null; avatarFrame: string | null };
}

/** POST /cosmetics/:id/buy */
export interface CosmeticBuyResponse extends CosmeticsResponse {
  wallet: WalletDto;
}
