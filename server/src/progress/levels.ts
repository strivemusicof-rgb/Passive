/** Total XP needed to reach `level` (level 1 = 0, 2 = 100, 3 = 300, 4 = 600 …). */
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  return level;
}

/** XP gathered inside the current level and how much the level takes in total. */
export function levelProgress(xp: number): { level: number; current: number; needed: number } {
  const level = levelForXp(xp);
  return { level, current: xp - xpForLevel(level), needed: xpForLevel(level + 1) - xpForLevel(level) };
}

/**
 * Login streak: claiming on consecutive days moves 1 → 7; after day 7, or
 * after a missed day, it starts again at 1.
 */
export function nextStreakDay(streakDay: number, lastClaim: string | null, yesterday: string): number {
  if (lastClaim === yesterday && streakDay >= 1 && streakDay < 7) return streakDay + 1;
  return 1;
}
