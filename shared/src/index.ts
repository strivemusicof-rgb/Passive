// Types shared by the app and the server. Keep this file free of runtime
// dependencies so both Metro and Node can import it as plain TypeScript.

export type * from './api.js';

export const LANGUAGES = ['lv', 'ru', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
export type Rarity = (typeof RARITIES)[number];

export interface HealthResponse {
  status: 'ok';
  version: string;
  /** Lowest app build the server still supports; older builds must update. */
  minAppVersion: string;
  time: string;
}
