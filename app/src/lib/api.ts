import type {
  LeaderboardResponse,
  LeaderboardScope,
  ListingDto,
  MarketBuyResponse,
  MarketResponse,
  MarketSort,
  MyMarketResponse,
  AdPlacement,
  AdRewardResponse,
  AdsDto,
  ApiErrorCode,
  AchievementDto,
  AuthResponse,
  BuyPlotResponse,
  CollectResponse,
  DailyRewardDto,
  IncomeDto,
  HealthResponse,
  Language,
  MapPlotsResponse,
  MissionsResponse,
  PlotDto,
  RewardsDto,
  RewardResponse,
  UpgradeResponse,
  UserDto,
  WalletDto,
} from '@landrush/shared';
import type { CellBounds } from '@landrush/shared/grid';

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
  wallet: () => request<WalletDto>('GET', '/wallet'),
  mapPlots: (b: CellBounds) =>
    request<MapPlotsResponse>(
      'GET',
      `/map/plots?south=${b.south}&west=${b.west}&north=${b.north}&east=${b.east}`,
    ),
  plot: (key: string) => request<PlotDto>('GET', `/plots/${encodeURIComponent(key)}`),
  buyPlot: (key: string) => request<BuyPlotResponse>('POST', `/plots/${encodeURIComponent(key)}/buy`),
  claimStarter: (lat: number, lng: number) =>
    request<BuyPlotResponse>('POST', '/plots/starter', { lat, lng }),
  myPlots: () => request<PlotDto[]>('GET', '/me/plots'),
  income: () => request<IncomeDto>('GET', '/me/income'),
  collect: () => request<CollectResponse>('POST', '/collect'),
  upgradePlot: (key: string) =>
    request<UpgradeResponse>('POST', `/plots/${encodeURIComponent(key)}/upgrade`),
  upgradeStorage: () => request<Pick<CollectResponse, 'wallet' | 'income'>>('POST', '/me/storage/upgrade'),
  missions: () => request<MissionsResponse>('GET', '/missions'),
  claimMission: (scope: 'daily' | 'weekly', key: string) =>
    request<RewardResponse>('POST', `/missions/${scope}/${encodeURIComponent(key)}/claim`),
  daily: () => request<DailyRewardDto>('GET', '/daily'),
  claimDaily: () => request<RewardResponse & { daily: DailyRewardDto }>('POST', '/daily/claim'),
  checkIn: (key: string, lat: number, lng: number) =>
    request<RewardResponse>('POST', `/plots/${encodeURIComponent(key)}/checkin`, { lat, lng }),
  achievements: () => request<AchievementDto[]>('GET', '/me/achievements'),
  rewards: () => request<RewardsDto>('GET', '/rewards'),
  cashout: (method: string, destination: string) =>
    request<RewardsDto>('POST', '/rewards/cashout', { method, destination }),
  ads: () => request<AdsDto>('GET', '/ads'),
  startAd: (placement: AdPlacement) => request<{ id: string }>('POST', '/ads/start', { placement }),
  completeAd: (id: string) => request<AdRewardResponse>('POST', `/ads/${id}/complete`),
  market: (q: { sort?: MarketSort; q?: string; favourites?: boolean }) => {
    const params = new URLSearchParams();
    if (q.sort) params.set('sort', q.sort);
    if (q.q) params.set('q', q.q);
    if (q.favourites) params.set('favourites', '1');
    return request<MarketResponse>('GET', `/market?${params.toString()}`);
  },
  myMarket: () => request<MyMarketResponse>('GET', '/market/mine'),
  listPlot: (key: string, price: number) =>
    request<ListingDto>('POST', `/plots/${encodeURIComponent(key)}/list`, { price }),
  cancelListing: (id: string) => request<ListingDto>('POST', `/market/${id}/cancel`),
  buyListing: (id: string) => request<MarketBuyResponse>('POST', `/market/${id}/buy`),
  leaderboard: (scope: LeaderboardScope) => request<LeaderboardResponse>('GET', `/leaderboard?scope=${scope}`),
  favourite: (key: string, on: boolean) =>
    request<{ favourite: boolean }>(on ? 'PUT' : 'DELETE', `/plots/${encodeURIComponent(key)}/favourite`),
};
