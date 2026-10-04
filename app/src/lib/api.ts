import type { HealthResponse } from '@landrush/shared';

/** Set EXPO_PUBLIC_API_URL in app/.env (dev) or eas.json (builds). */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  health: () => get<HealthResponse>('/health'),
};
