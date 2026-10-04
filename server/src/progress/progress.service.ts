import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import type { AchievementDto, DailyRewardDto, MissionDto, MissionsResponse, Rarity, RewardResponse } from '@landrush/shared';
import { cellCenter, cellKey, distanceM, type Cell } from '@landrush/shared/grid';

import { EconomyService, type MissionDef } from '../economy/economy.service.js';
import { plotIncomePerDay } from '../economy/income.js';
import { Prisma } from '../generated/prisma/client.js';
import { IncomeService, ownedNeighbours } from '../income/income.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RewardsService } from '../rewards/rewards.service.js';
import { toUserDto } from '../users/users.service.js';
import { WalletService, type Tx } from '../wallet/wallet.service.js';
import { nextStreakDay } from './levels.js';
import { dailyPeriod, gameDay, nextResets, previousDay, weeklyPeriod } from './periods.js';
import { TrackerService } from './tracker.service.js';

type Gain = { coins: number; gems: number; xp: number; points?: number };

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
    private readonly wallet: WalletService,
    private readonly income: IncomeService,
    private readonly tracker: TrackerService,
    private readonly rewards: RewardsService,
  ) {}

  async missions(userId: string, now = new Date()): Promise<MissionsResponse> {
    const economy = await this.economy.get();
    const [daily, weekly] = [dailyPeriod(now), weeklyPeriod(now)];
    const rows = await this.prisma.missionProgress.findMany({ where: { userId, period: { in: [daily, weekly] } } });
    const view = (period: string, defs: MissionDef[]): MissionDto[] =>
      defs.map((d) => {
        const row = rows.find((r) => r.period === period && r.key === d.key);
        return { key: d.key, progress: row?.progress ?? 0, target: d.target, claimed: !!row?.claimedAt, coins: d.coins, gems: d.gems, xp: d.xp };
      });
    const resets = nextResets(now);
    return {
      daily: view(daily, economy.missions.daily),
      weekly: view(weekly, economy.missions.weekly),
      dailyResetsAt: resets.daily,
      weeklyResetsAt: resets.weekly,
    };
  }

  async claimMission(userId: string, scope: 'daily' | 'weekly', key: string, now = new Date()): Promise<RewardResponse> {
    const economy = await this.economy.get();
    const def = economy.missions[scope].find((m) => m.key === key);
    if (!def) throw new BadRequestException({ code: 'validation_failed' });
    const period = scope === 'daily' ? dailyPeriod(now) : weeklyPeriod(now);
    return this.prisma.$transaction(async (tx) => {
      await this.income.lock(tx, userId);
      // Conditional update: a mission can only be claimed once, even with two taps.
      const { count } = await tx.missionProgress.updateMany({
        where: { userId, period, key, claimedAt: null, progress: { gte: def.target } },
        data: { claimedAt: now },
      });
      if (count !== 1) {
        const row = await tx.missionProgress.findUnique({ where: { userId_period_key: { userId, period, key } } });
        throw new BadRequestException({ code: row?.claimedAt ? 'already_claimed' : 'not_complete' });
      }
      const points = scope === 'weekly' ? await this.rewards.award(tx, userId, economy.rewards.earn.weeklyMission, 'weekly_mission', `${period}:${key}`) : 0;
      return this.pay(tx, userId, { coins: def.coins, gems: def.gems, xp: def.xp, points }, 'mission_reward', `${period}:${key}`);
    });
  }

  async daily(userId: string, now = new Date()): Promise<DailyRewardDto> {
    const economy = await this.economy.get();
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const today = gameDay(now);
    const claimedToday = user.lastDailyClaim === today;
    return {
      nextDay: claimedToday ? user.streakDay : nextStreakDay(user.streakDay, user.lastDailyClaim, previousDay(today)),
      claimedToday,
      streakDay: user.streakDay,
      rewards: economy.dailyRewards,
    };
  }

  async claimDaily(userId: string, now = new Date()): Promise<RewardResponse & { daily: DailyRewardDto }> {
    const economy = await this.economy.get();
    const today = gameDay(now);
    const res = await this.prisma.$transaction(async (tx) => {
      await this.income.lock(tx, userId);
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.lastDailyClaim === today) throw new ConflictException({ code: 'already_claimed' });
      const day = nextStreakDay(user.streakDay, user.lastDailyClaim, previousDay(today));
      await tx.user.update({ where: { id: userId }, data: { streakDay: day, lastDailyClaim: today } });
      await this.tracker.track(tx, userId, 'login', 1, now);
      const reward = economy.dailyRewards[day - 1] ?? { coins: 0, gems: 0 };
      const points = day === 7 ? await this.rewards.award(tx, userId, economy.rewards.earn.streakDay7, 'streak', today) : 0;
      return this.pay(tx, userId, { ...reward, xp: economy.xpFor.dailyReward, points }, 'daily_reward', `${today}:day${day}`);
    });
    return { ...res, daily: await this.daily(userId, now) };
  }

  /** Standing within `radiusM` of your own plot: a bonus once per plot per day. */
  async checkIn(userId: string, cell: Cell, at: { lat: number; lng: number }, now = new Date()): Promise<RewardResponse> {
    const economy = await this.economy.get();
    const day = gameDay(now);
    return this.prisma.$transaction(async (tx) => {
      await this.income.lock(tx, userId);
      const plot = await tx.plot.findUnique({ where: { row_col: cell } });
      if (!plot || plot.ownerId !== userId) throw new ForbiddenException({ code: 'not_your_plot' });
      if (distanceM(at, cellCenter(cell)) > economy.checkIn.radiusM) throw new BadRequestException({ code: 'too_far' });
      const today = await tx.checkIn.count({ where: { userId, day } });
      if (today >= economy.checkIn.maxPerDay) throw new BadRequestException({ code: 'check_in_limit' });

      const mine = await tx.plot.findMany({ where: { ownerId: userId }, select: { row: true, col: true } });
      const perDay = plotIncomePerDay(
        { rarity: plot.rarity as Rarity, buildingLevel: plot.buildingLevel, neighbours: ownedNeighbours(plot, new Set(mine.map((p) => cellKey(p)))) },
        economy,
      );
      const coins = Math.max(1, Math.round(perDay * economy.checkIn.rewardShare));
      try {
        await tx.checkIn.create({ data: { userId, row: cell.row, col: cell.col, day, reward: coins } });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new ConflictException({ code: 'already_checked_in' });
        }
        throw e;
      }
      await this.tracker.track(tx, userId, 'checkIn', 1, now);
      const points = await this.rewards.award(tx, userId, economy.rewards.earn.checkIn, 'check_in', `${day}:${cellKey(cell)}`);
      return this.pay(tx, userId, { coins, gems: 0, xp: economy.xpFor.checkIn, points }, 'check_in', `${day}:${cellKey(cell)}`);
    });
  }

  async achievements(userId: string): Promise<AchievementDto[]> {
    const [user, plots, checkIns] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.plot.findMany({ where: { ownerId: userId }, select: { rarity: true, buildingLevel: true } }),
      this.prisma.checkIn.count({ where: { userId } }),
    ]);
    const maxBuilding = Math.max(0, ...plots.map((p) => p.buildingLevel));
    const has = (r: string) => (plots.some((p) => p.rarity === r) ? 1 : 0);
    const list: [string, number, number][] = [
      ['firstPlot', plots.length, 1],
      ['plots10', plots.length, 10],
      ['plots50', plots.length, 50],
      ['firstHouse', maxBuilding >= 1 ? 1 : 0, 1],
      ['firstTower', maxBuilding >= 4 ? 1 : 0, 1],
      ['rarePlot', has('rare') || has('epic') || has('legendary'), 1],
      ['legendaryPlot', has('legendary'), 1],
      ['level5', user.level, 5],
      ['level10', user.level, 10],
      ['streak7', user.streakDay, 7],
      ['checkIns10', checkIns, 10],
    ];
    return list.map(([key, progress, target]) => ({ key, progress: Math.min(progress, target), target, unlocked: progress >= target }));
  }

  /** Pays coins/gems/XP inside the transaction and returns the new state. */
  private async pay(tx: Tx, userId: string, gain: Gain, type: string, ref: string): Promise<RewardResponse> {
    let wallet = await this.wallet.ensure(tx, userId);
    if (gain.coins > 0) wallet = await this.wallet.change(tx, userId, 'coins', gain.coins, type, ref);
    if (gain.gems > 0) wallet = await this.wallet.change(tx, userId, 'gems', gain.gems, type, ref);
    const level = await this.tracker.addXp(tx, userId, gain.xp);
    // Points (and level-up gems) were added by other services: re-read the wallet.
    if (level.gems > 0 || level.points > 0 || (gain.points ?? 0) > 0) wallet = await this.wallet.ensure(tx, userId);
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      coins: gain.coins,
      gems: gain.gems + level.gems,
      points: (gain.points ?? 0) + level.points,
      xp: gain.xp,
      leveledUp: level.leveledUp,
      wallet,
      user: toUserDto(user),
    };
  }
}

