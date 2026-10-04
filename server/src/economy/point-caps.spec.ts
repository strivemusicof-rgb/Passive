import { ECONOMY_DEFAULTS, pointCaps } from './economy.service.js';

describe('⭐ daily limits', () => {
  const { rewards } = ECONOMY_DEFAULTS;

  it('start at the level-1 numbers', () => {
    expect(pointCaps(rewards, 1)).toEqual({ daily: 150, land: 60 });
  });

  it('grow with level and stop at the maximum', () => {
    expect(pointCaps(rewards, 11)).toEqual({ daily: 250, land: 110 });
    expect(pointCaps(rewards, 100)).toEqual({ daily: 400, land: 250 });
  });
});
