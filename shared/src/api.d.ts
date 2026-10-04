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
  | 'area_too_large';

export interface WalletDto {
  coins: number;
  gems: number;
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
  /** Owned plots only (free plots earn nothing until bought). */
  incomePerDay: number;
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
}
