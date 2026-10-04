// Web preview: no AdMob. Pretend the ad was watched so the flow can be tested.
export type AdResult = { result: 'earned' | 'closed' | 'unavailable'; reason?: string };

export const initAds = async () => true;

export async function showRewardedAd(_userId: string, _customData: string): Promise<AdResult> {
  await new Promise((r) => setTimeout(r, 500));
  return { result: 'earned' };
}
