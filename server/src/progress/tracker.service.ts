import { Injectable } from '@nestjs/common';

import { EconomyService, type MissionDef, type MissionEvent } from '../economy/economy.service.js';
import { WalletService, type Tx } from '../wallet/wallet.service.js';
import { levelForXp } from './levels.js';
import { dailyPeriod, weeklyPeriod } from './periods.js';

/** Mission counters and XP. Used inside other services' transactions. */
@Injectable()
export class TrackerService {
  constructor(
    private readonly economy: EconomyService,
    private readonly wallet: WalletService,
  ) {}

  /** Counts an action towards every daily and weekly mission that listens to it. */
  async track(tx: Tx, userId: string, event: MissionEvent, amount = 1, now = new Date()): Promise<void> {
    const economy = await this.economy.get();
    const periods: [string, MissionDef[]][] = [
      [dailyPeriod(now), economy.missions.daily],
      [weeklyPeriod(now), economy.missions.weekly],
    ];
    for (const [period, defs] of periods) {
      for (const m of defs.filter((d) => d.event === event)) {
        await tx.$executeRaw`
          INSERT INTO mission_progress (user_id, period, key, progress)
          VALUES (${userId}::uuid, ${period}, ${m.key}, ${Math.min(amount, m.target)})
          ON CONFLICT (user_id, period, key) DO UPDATE
          SET progress = LEAST(mission_progress.progress + ${amount}, ${m.target})`;
      }
    }
  }

  /** Adds XP; every level gained pays `levelUpGems`. */
  async addXp(tx: Tx, userId: string, xp: number): Promise<{ leveledUp: boolean; gems: number }> {
    if (xp <= 0) return { leveledUp: false, gems: 0 };
    const economy = await this.economy.get();
    const user = await tx.user.update({ where: { id: userId }, data: { xp: { increment: xp } } });
    const level = levelForXp(user.xp);
    if (level <= user.level) return { leveledUp: false, gems: 0 };
    await tx.user.update({ where: { id: userId }, data: { level } });
    const gems = (level - user.level) * economy.levelUpGems;
    if (gems > 0) await this.wallet.change(tx, userId, 'gems', gems, 'level_up', String(level));
    return { leveledUp: true, gems };
  }
}
