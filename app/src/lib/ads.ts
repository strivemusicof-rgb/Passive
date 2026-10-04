import Constants from 'expo-constants';
import { getTrackingPermissionsAsync, requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import mobileAds, { AdEventType, AdsConsent, RewardedAd, RewardedAdEventType, TestIds } from 'react-native-google-mobile-ads';

/**
 * Rewarded ad unit from app.json (extra.admob.iosRewarded). Development builds
 * always use Google's test unit: watching your own real ads can get the AdMob
 * account blocked.
 */
const UNIT_ID: string = (!__DEV__ && Constants.expoConfig?.extra?.admob?.iosRewarded) || TestIds.REWARDED;
const LOAD_TIMEOUT_MS = 20_000;

let ready: Promise<boolean> | null = null;
let initError = 'init';

/**
 * Once per app run: the EU consent form (only shown where the law needs it),
 * then Apple's "allow tracking?" question, then start the ad SDK.
 */
export function initAds(): Promise<boolean> {
  return (ready ??= (async () => {
    try {
      // Without a consent form set up in AdMob this fails; ads still work (non-personalised).
      const consent = await AdsConsent.gatherConsent().catch(() => null);
      if (consent && !consent.canRequestAds) {
        initError = 'consent';
        return false;
      }
      const { status } = await getTrackingPermissionsAsync();
      if (status === 'undetermined') await requestTrackingPermissionsAsync();
      await mobileAds().initialize();
      return true;
    } catch (e) {
      initError = e instanceof Error ? e.message : 'init';
      ready = null;
      return false;
    }
  })());
}

/** `reason` (when unavailable) is AdMob's error code, e.g. "no-fill". */
export type AdResult = { result: 'earned' | 'closed' | 'unavailable'; reason?: string };

/**
 * Loads and shows one rewarded ad. userId + customData go to Google, which
 * passes them to our server's verification callback.
 */
export async function showRewardedAd(userId: string, customData: string): Promise<AdResult> {
  if (!(await initAds())) return { result: 'unavailable', reason: initError };
  return new Promise((resolve) => {
    const ad = RewardedAd.createForAdRequest(UNIT_ID, { serverSideVerificationOptions: { userId, customData } });
    let earned = false;
    let finished = false;
    const unsubscribe: (() => void)[] = [];
    const done = (result: AdResult['result'], reason?: string) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      unsubscribe.forEach((u) => u());
      resolve({ result, reason });
    };
    const timer = setTimeout(() => done('unavailable', 'timeout'), LOAD_TIMEOUT_MS);
    unsubscribe.push(
      ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        clearTimeout(timer);
        ad.show().catch((e: unknown) => done('unavailable', e instanceof Error ? e.message : 'show'));
      }),
      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      }),
      ad.addAdEventListener(AdEventType.CLOSED, () => done(earned ? 'earned' : 'closed')),
      ad.addAdEventListener(AdEventType.ERROR, (error) => done('unavailable', errorCode(error))),
    );
    ad.load();
  });
}

/** "googleMobileAds/no-fill" → "no-fill" */
function errorCode(error: unknown): string {
  const code = (error as { code?: string } | undefined)?.code ?? (error as Error | undefined)?.message ?? 'error';
  return String(code).replace(/^googleMobileAds\//, '');
}
