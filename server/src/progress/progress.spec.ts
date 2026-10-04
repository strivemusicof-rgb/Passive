import { levelForXp, levelProgress, nextStreakDay, xpForLevel } from './levels.js';
import { gameDay, gameWeek, nextResets, previousDay } from './periods.js';

describe('levels', () => {
  it('needs 100, 300, 600 … XP', () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 100, 300, 600, 1000]);
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(1000)).toBe(5);
  });

  it('reports progress inside a level', () => {
    expect(levelProgress(350)).toEqual({ level: 3, current: 50, needed: 300 });
  });
});

describe('login streak', () => {
  it('goes 1 → 7 on consecutive days, then starts over', () => {
    expect(nextStreakDay(0, null, '2026-10-03')).toBe(1);
    expect(nextStreakDay(3, '2026-10-03', '2026-10-03')).toBe(4);
    expect(nextStreakDay(7, '2026-10-03', '2026-10-03')).toBe(1);
  });

  it('a missed day resets to day 1', () => {
    expect(nextStreakDay(5, '2026-10-01', '2026-10-03')).toBe(1);
  });
});

describe('Riga periods', () => {
  it('uses Riga midnight, not UTC', () => {
    // 22:30 UTC on 3 Oct = 01:30 on 4 Oct in Riga (UTC+3 in summer time)
    expect(gameDay(new Date('2026-10-03T22:30:00Z'))).toBe('2026-10-04');
    expect(gameDay(new Date('2026-10-03T20:00:00Z'))).toBe('2026-10-03');
  });

  it('knows the day before, across months', () => {
    expect(previousDay('2026-11-01')).toBe('2026-10-31');
  });

  it('ISO weeks start on Monday', () => {
    expect(gameWeek(new Date('2026-10-04T10:00:00Z'))).toBe('2026-W40'); // Sunday
    expect(gameWeek(new Date('2026-10-05T10:00:00Z'))).toBe('2026-W41'); // Monday
    expect(gameWeek(new Date('2027-01-01T10:00:00Z'))).toBe('2026-W53');
  });

  it('next reset is the coming Riga midnight', () => {
    expect(nextResets(new Date('2026-10-04T10:00:00Z')).daily).toBe('2026-10-04T21:00:00.000Z');
    expect(nextResets(new Date('2026-10-04T10:00:00Z')).weekly).toBe('2026-10-04T21:00:00.000Z');
  });
});
