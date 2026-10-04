import type { TFunction } from 'i18next';

import { ApiError } from './api';

/** Player-friendly, translated message for any error thrown by the API client. */
export function errorMessage(t: TFunction, e: unknown): string {
  const code = e instanceof ApiError ? e.code : 'unknown';
  return t(`errors.${code}`, { defaultValue: t('errors.unknown') });
}
