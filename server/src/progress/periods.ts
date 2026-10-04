/** Days and weeks follow Riga time, so missions reset at local midnight. */
export const GAME_TZ = 'Europe/Riga';

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: GAME_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

/** "2026-10-04" (Riga calendar day). */
export function gameDay(at: Date): string {
  return dayFormat.format(at);
}

/** The calendar day before `day` ("YYYY-MM-DD"). */
export function previousDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** ISO week of the Riga day, e.g. "2026-W40" (weeks start on Monday). */
export function gameWeek(at: Date): string {
  const d = new Date(`${gameDay(at)}T12:00:00Z`);
  const weekday = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - weekday + 3); // Thursday decides the year
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Next Riga midnight (daily reset) and next Monday midnight (weekly reset), as ISO times. */
export function nextResets(at: Date): { daily: string; weekly: string } {
  const offsetMin = rigaOffsetMinutes(at);
  const local = new Date(at.getTime() + offsetMin * 60_000);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1);
  const daysToMonday = (8 - local.getUTCDay()) % 7 || 7;
  const monday = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + daysToMonday);
  // Offset can change at DST; using the offset at `at` is accurate to the hour, fine for a countdown.
  return {
    daily: new Date(midnight - offsetMin * 60_000).toISOString(),
    weekly: new Date(monday - offsetMin * 60_000).toISOString(),
  };
}

function rigaOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: GAME_TZ, timeZoneName: 'longOffset' }).formatToParts(at);
  const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+00:00';
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}

export const dailyPeriod = (at: Date) => `d:${gameDay(at)}`;
export const weeklyPeriod = (at: Date) => `w:${gameWeek(at)}`;
