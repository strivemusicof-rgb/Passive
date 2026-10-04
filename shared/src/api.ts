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
  | 'too_many_requests';
