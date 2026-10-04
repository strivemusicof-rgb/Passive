import type {
  ApiErrorCode,
  AuthResponse,
  HealthResponse,
  Language,
  UserDto,
} from '@landrush/shared';

/** Set EXPO_PUBLIC_API_URL in app/.env (dev) or eas.json (builds). */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | 'network_error' | 'unknown',
  ) {
    super(code);
  }
}

type Session = {
  accessToken: string | null;
  /** Called on 401 to get a fresh access token; returns null if signed out. */
  refresh: (() => Promise<string | null>) | null;
};

const session: Session = { accessToken: null, refresh: null };

export function setSession(accessToken: string | null, refresh: Session['refresh']) {
  session.accessToken = accessToken;
  session.refresh = refresh;
}

async function request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (session.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network_error');
  }

  // Access tokens are short-lived: refresh once and retry.
  if (res.status === 401 && retry && session.accessToken && session.refresh) {
    const fresh = await session.refresh();
    if (fresh) return request<T>(method, path, body, false);
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { code?: ApiErrorCode };
    throw new ApiError(
      res.status,
      data.code ?? (res.status === 429 ? 'too_many_requests' : 'unknown'),
    );
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  health: () => request<HealthResponse>('GET', '/health'),
  guest: () => request<AuthResponse>('POST', '/auth/guest'),
  apple: (identityToken: string) => request<AuthResponse>('POST', '/auth/apple', { identityToken }),
  register: (email: string, password: string) =>
    request<AuthResponse>('POST', '/auth/email/register', { email, password }),
  login: (email: string, password: string) =>
    request<AuthResponse>('POST', '/auth/email/login', { email, password }),
  refresh: (refreshToken: string) =>
    request<AuthResponse>('POST', '/auth/refresh', { refreshToken }, false),
  logout: (refreshToken: string) => request<void>('POST', '/auth/logout', { refreshToken }, false),
  me: () => request<UserDto>('GET', '/me'),
  updateMe: (data: { displayName?: string; language?: Language }) =>
    request<UserDto>('PATCH', '/me', data),
  deleteMe: () => request<void>('DELETE', '/me'),
};
