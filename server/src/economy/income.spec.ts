import { ECONOMY_DEFAULTS } from './economy.service.js';
import { pendingCoins, plotIncomePerDay, storageFullAt } from './income.js';

const NOW = new Date('2026-10-04T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const common = (h: number, neighbours = 0, buildingLevel = 0) => ({
  rarity: 'common' as const,
  buildingLevel,
  neighbours,
  collectedAt: hoursAgo(h),
});

describe('income', () => {
  it('a common empty plot earns 48/day = 2/hour', () => {
    expect(plotIncomePerDay(common(0), ECONOMY_DEFAULTS)).toBe(48);
    expect(pendingCoins([common(3)], 8, NOW, ECONOMY_DEFAULTS)).toBe(6);
  });

  it('stops at the storage limit', () => {
    expect(pendingCoins([common(30)], 8, NOW, ECONOMY_DEFAULTS)).toBe(16);
    expect(pendingCoins([common(30)], 24, NOW, ECONOMY_DEFAULTS)).toBe(48);
  });

  it('buildings add income', () => {
    expect(plotIncomePerDay(common(0, 0, 1), ECONOMY_DEFAULTS)).toBe(96);
    expect(plotIncomePerDay(common(0, 0, 4), ECONOMY_DEFAULTS)).toBe(1488);
  });

  it('owned neighbours add 5% each, at most 8', () => {
    expect(plotIncomePerDay(common(0, 2), ECONOMY_DEFAULTS)).toBe(53);
    expect(plotIncomePerDay(common(0, 12), ECONOMY_DEFAULTS)).toBe(plotIncomePerDay(common(0, 8), ECONOMY_DEFAULTS));
  });

  it('keeps fractions across plots before rounding down', () => {
    // 3 plots × 2/h × 0.25 h = 1.5 → 1
    expect(pendingCoins([common(0.25), common(0.25), common(0.25)], 8, NOW, ECONOMY_DEFAULTS)).toBe(1);
  });

  it('never pays for time in the future', () => {
    expect(pendingCoins([common(-5)], 8, NOW, ECONOMY_DEFAULTS)).toBe(0);
  });

  it('storage is full 8 hours after the newest collect', () => {
    expect(storageFullAt([common(2), common(5)], 8)?.toISOString()).toBe(hoursAgo(-6).toISOString());
    expect(storageFullAt([], 8)).toBeNull();
  });
});
