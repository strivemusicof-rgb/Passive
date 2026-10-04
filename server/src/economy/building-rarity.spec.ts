import { ECONOMY_DEFAULTS } from './economy.service.js';
import { buildingCost, buildingIncome, plotIncome } from './rarity.js';

describe('buildings by rarity', () => {
  const e = ECONOMY_DEFAULTS;

  it('common land uses the base prices', () => {
    expect(buildingCost('common', 1, e)).toBe(500);
    expect(buildingIncome('common', 1, e)).toBe(48);
    expect(plotIncome('common', 1, e)).toBe(48 + 48);
  });

  it('rarer land earns more and costs more, and pays back sooner', () => {
    expect(buildingIncome('legendary', 4, e)).toBe(Math.round(1440 * 3.2));
    expect(buildingCost('legendary', 4, e)).toBe(92000);
    for (const level of [1, 2, 3, 4]) {
      const payback = (r: 'common' | 'rare' | 'legendary') => buildingCost(r, level, e) / buildingIncome(r, level, e);
      expect(payback('rare')).toBeLessThan(payback('common'));
      expect(payback('legendary')).toBeLessThan(payback('rare'));
    }
  });

  it('nothing for the empty level', () => {
    expect(buildingCost('epic', 0, e)).toBe(0);
    expect(buildingIncome('epic', 0, e)).toBe(0);
  });
});
