import { RARITIES, type Rarity } from '@landrush/shared';
import { cellAt } from '@landrush/shared/grid';

import { ECONOMY_DEFAULTS } from './economy.service.js';
import { hotspotBoost, plotIncome, plotPrice, rarityOdds, rollRarity } from './rarity.js';

const COUNTRYSIDE = cellAt(56.85, 24.4);
const FREEDOM_MONUMENT = cellAt(56.9514, 24.1133);

describe('rarity odds', () => {
  it('match the configured weights away from landmarks', () => {
    const odds = rarityOdds(COUNTRYSIDE, ECONOMY_DEFAULTS);
    expect(odds.common).toBeCloseTo(0.6);
    expect(odds.uncommon).toBeCloseTo(0.25);
    expect(odds.rare).toBeCloseTo(0.1);
    expect(odds.epic).toBeCloseTo(0.04);
    expect(odds.legendary).toBeCloseTo(0.01);
  });

  it('always add up to 100%', () => {
    for (const cell of [COUNTRYSIDE, FREEDOM_MONUMENT, cellAt(56.9488, 24.1064)]) {
      const sum = RARITIES.reduce((s, r) => s + rarityOdds(cell, ECONOMY_DEFAULTS)[r], 0);
      expect(sum).toBeCloseTo(1, 10);
    }
  });

  it('are better at landmarks', () => {
    expect(hotspotBoost(FREEDOM_MONUMENT, ECONOMY_DEFAULTS)).toBeGreaterThan(1);
    const here = rarityOdds(FREEDOM_MONUMENT, ECONOMY_DEFAULTS);
    const there = rarityOdds(COUNTRYSIDE, ECONOMY_DEFAULTS);
    expect(here.legendary).toBeGreaterThan(there.legendary * 2);
    expect(here.common).toBeLessThan(there.common);
  });
});

describe('rolling', () => {
  it('follows the shown odds', () => {
    const odds = rarityOdds(FREEDOM_MONUMENT, ECONOMY_DEFAULTS);
    const counts = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>;
    const n = 50_000;
    for (let i = 0; i < n; i++) counts[rollRarity(odds)]++;
    for (const r of RARITIES) expect(counts[r] / n).toBeCloseTo(odds[r], 1);
  });

  it('maps the roll onto the bands in order', () => {
    const odds = rarityOdds(COUNTRYSIDE, ECONOMY_DEFAULTS);
    expect(rollRarity(odds, () => 0)).toBe('common');
    expect(rollRarity(odds, () => 0.7)).toBe('uncommon');
    expect(rollRarity(odds, () => 0.9999)).toBe('legendary');
  });
});

describe('prices and income', () => {
  it('all free plots cost the same; each owned plot adds 5%', () => {
    expect(plotPrice(0, ECONOMY_DEFAULTS)).toBe(150);
    expect(plotPrice(1, ECONOMY_DEFAULTS)).toBe(158);
    expect(plotPrice(10, ECONOMY_DEFAULTS)).toBe(225);
  });

  it('income = rarity base + building bonus', () => {
    expect(plotIncome('rare', 0, ECONOMY_DEFAULTS)).toBe(120);
    expect(plotIncome('rare', 1, ECONOMY_DEFAULTS)).toBe(120 + Math.round(48 * 1.7)); // rare land: house earns 1.7×
  });
});
