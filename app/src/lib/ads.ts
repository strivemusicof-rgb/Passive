import Constants from 'expo-constants';
import { getTrackingPermissionsAsync, requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import mobileAds, { AdEventType, AdsConsent, RewardedAd, RewardedAdEventType, TestIds } from 'react-native-google-mobile-ads';

/** Rewarded ad unit from app.json (extra.admob.iosRewarded); Google's test unit until it's set. */
const UNIT_ID: string = Constants.expoConfig?.extra?.admob?.iosRewarded || TestIds.REWARDED;
const LOAD_TIMEOUT_MS = 20_000;

let ready: Promise<boolean> | null = null;

/**
 * Once per app run: the EU consent form (only shown where the law needs it),
 * then Apple's "allow tracking?" question, then start the ad SDK.
 */
export function initAds(): Promise<boolean> {
  return (ready ??= (async () => {
    try {
      // Without a consent form set up in AdMob this fails; ads still work (non-personalised).
      const consent = await AdsConsent.gatherConsent().catch(() => null);
      if (consent && !consent.canRequestAds) return false;
      const { status } = await getTrackingPermissionsAsync();
      if (status === 'undetermined') await requestTrackingPermissionsAsync();
      await mobileAds().initialize();
      return true;
    } catch {
      ready = null;
      return false;
    }
  })());
}

export type AdResult = 'earned' | 'closed' | 'unavailable';

/**
 * Loads and shows one rewarded ad. userId + customData go to Google, which
 * passes them to our server's verification callback.
 */
export async function showRewardedAd(userId: string, customData: string): Promise<AdResult> {
  if (!(await initAds())) return 'unavailable';
  return new Promise((resolve) => {
    const ad = RewardedAd.createForAdRequest(UNIT_ID, { serverSideVerificationOptions: { userId, customData } });
    let earned = false;
    let finished = false;
    const unsubscribe: (() => void)[] = [];
    const done = (result: AdResult) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      unsubscribe.forEach((u) => u());
      resolve(result);
    };
    const timer = setTimeout(() => done('unavailable'), LOAD_TIMEOUT_MS);
    unsubscribe.push(
      ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        clearTimeout(timer);
        ad.show().catch(() => done('unavailable'));
      }),
      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      }),
      ad.addAdEventListener(AdEventType.CLOSED, () => done(earned ? 'earned' : 'closed')),
      ad.addAdEventListener(AdEventType.ERROR, () => done('unavailable')),
    );
    ad.load();
  });
}
