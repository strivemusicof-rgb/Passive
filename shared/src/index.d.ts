export type * from './api.js';

export declare const LANGUAGES: readonly ['lv', 'ru', 'en'];
export type Language = (typeof LANGUAGES)[number];

export declare const RARITIES: readonly ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export type Rarity = (typeof RARITIES)[number];

export interface HealthResponse {
  status: 'ok';
  version: string;
  /** Lowest app build the server still supports; older builds must update. */
  minAppVersion: string;
  time: string;
}
