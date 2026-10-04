import { Injectable } from '@nestjs/common';
import type { LeaderboardEntry, LeaderboardResponse, LeaderboardScope, Rarity } from '@landrush/shared';

import { EconomyService, type Economy } from '../economy/economy.service.js';
import { plotIncome } from '../economy/rarity.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { gameMonth } from '../progress/periods.js';
import { WalletService } from '../wallet/wallet.service.js';

/** Boards are recalculated at most this often (they cover every player). */
const CACHE_MS = 60_000;

type Row = { userId: string; plots: number; perDay: number; score: number };

const perHour = (perDay: number) => Math.round((perDay / 24) * 10) / 10;

@Injectable()
export class LeaderboardService {
  private cache = new Map<string, { at: number; rows: Row[] }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
    private readonly wallet: WalletService,
  ) {}

  async board(viewerId: string, scope: LeaderboardScope, now = new Date()): Promise<LeaderboardResponse> {
    const economy = await this.economy.get();
    const month = gameMonth(now);
    await this.payLastMonth(now, economy);

    let rows: Row[];
    if (scope === 'near') rows = await this.near(viewerId, economy);
    else rows = await this.cached(scope === 'month' ? `month:${month.month}` : 'all', () =>
      scope === 'month' ? this.monthRanking(month.start, month.end, economy) : this.landRanking(economy),
    );

    const top = rows.slice(0, economy.leaderboard.size);
    const myIndex = rows.findIndex((r) => r.userId === viewerId);
    const wanted = [...top, ...(myIndex >= 0 ? [rows[myIndex]] : [])];
    const names = await this.names(wanted.map((r) => r.userId));
    const entry = (r: Row, i: number): LeaderboardEntry => ({
      rank: i + 1,
      userId: r.userId,
      displayName: names.get(r.userId) ?? '?',
      plots: r.plots,
      incomePerHour: perHour(r.perDay),
      score: r.score,
    });

    return {
      scope,
      entries: top.map(entry),
      me: myIndex >= 0 ? entry(rows[myIndex], myIndex) : null,
      monthlyPrizeGems: economy.leaderboard.monthlyPrizeGems,
      monthEndsAt: month.end.toISOString(),
      lastWinners: await this.lastWinners(now),
    };
  }

  /** Everyone with land, by land income (without the neighbour bonus, to keep it cheap). */
  private async landRanking(economy: Economy, where: Prisma.PlotWhereInput = {}): Promise<Row[]> {
    const groups = await this.prisma.plot.groupBy({ by: ['ownerId', 'rarity', 'buildingLevel'], where, _count: { _all: true } });
    const byUser = new Map<string, Row>();
    for (const g of groups) {
      const row = byUser.get(g.ownerId) ?? { userId: g.ownerId, plots: 0, perDay: 0, score: 0 };
      row.plots += g._count._all;
      row.perDay += plotIncome(g.rarity as Rarity, g.buildingLevel, economy) * g._count._all;
      byUser.set(g.ownerId, row);
    }
    const rows = [...byUser.values()];
    for (const r of rows) r.score = perHour(r.perDay);
    return rows.sort((a, b) => b.perDay - a.perDay || b.plots - a.plots || a.userId.localeCompare(b.userId));
  }

  /** Coins collected from land between start and end. */
  private async monthRanking(start: Date, end: Date, economy: Economy): Promise<Row[]> {
    const sums = await this.prisma.transaction.groupBy({
      by: ['userId'],
      where: { type: 'collect', currency: 'coins', createdAt: { gte: start, lt: end } },
      _sum: { amount: true },
    });
    const land = new Map((await this.cached('all', () => this.landRanking(economy))).map((r) => [r.userId, r]));
    return sums
      .map((s) => ({
        userId: s.userId,
        plots: land.get(s.userId)?.plots ?? 0,
        perDay: land.get(s.userId)?.perDay ?? 0,
        score: s._sum.amount ?? 0,
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.userId.localeCompare(b.userId));
  }

  /** Land income counting only plots around the player's newest plot. */
  private async near(viewerId: string, economy: Economy): Promise<Row[]> {
    const home = await this.prisma.plot.findFirst({ where: { ownerId: viewerId }, orderBy: { acquiredAt: 'desc' } });
    if (!home) return [];
    // Cells are ~0.0003° tall; columns are ~0.00055° wide at Baltic latitudes.
    const dRow = Math.round(economy.leaderboard.nearDeg / 0.0003);
    const dCol = Math.round(dRow * 1.8);
    return this.landRanking(economy, {
      row: { gte: home.row - dRow, lte: home.row + dRow },
      col: { gte: home.col - dCol, lte: home.col + dCol },
    });
  }

  /**
   * Pays last month's prizes the first time anyone opens a board in a new
   * month. The (month, rank) key makes it happen exactly once.
   */
  private async payLastMonth(now: Date, economy: Economy): Promise<void> {
    const last = gameMonth(new Date(gameMonth(now).start.getTime() - 1));
    if (await this.prisma.leaderboardPrize.findFirst({ where: { month: last.month } })) return;
    const ranking = await this.monthRanking(last.start, last.end, economy);
    const prizes = economy.leaderboard.monthlyPrizeGems;
    try {
      await this.prisma.$transaction(async (tx) => {
        const winners = ranking.slice(0, prizes.length);
        if (winners.length === 0) {
          await tx.leaderboardPrize.create({ data: { month: last.month, rank: 0 } });
          return;
        }
        for (const [i, w] of winners.entries()) {
          await tx.leaderboardPrize.create({ data: { month: last.month, rank: i + 1, userId: w.userId, gems: prizes[i], score: w.score } });
          if (prizes[i] > 0) await this.wallet.change(tx, w.userId, 'gems', prizes[i], 'leaderboard_prize', `${last.month}#${i + 1}`);
        }
      });
    } catch (e) {
      // Another request paid this month at the same moment.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return;
      throw e;
    }
  }

  private async lastWinners(now: Date) {
    const last = gameMonth(new Date(gameMonth(now).start.getTime() - 1));
    const rows = await this.prisma.leaderboardPrize.findMany({ where: { month: last.month, rank: { gt: 0 } }, orderBy: { rank: 'asc' } });
    const names = await this.names(rows.map((r) => r.userId!).filter(Boolean));
    return rows.map((r) => ({ rank: r.rank, displayName: (r.userId && names.get(r.userId)) || '?', gems: r.gems }));
  }

  private async names(ids: string[]): Promise<Map<string, string>> {
    const users = await this.prisma.user.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, displayName: true } });
    return new Map(users.map((u) => [u.id, u.displayName]));
  }

  private async cached(key: string, load: () => Promise<Row[]>): Promise<Row[]> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.rows;
    const rows = await load();
    this.cache.set(key, { at: Date.now(), rows });
    return rows;
  }

  /** Tests: forget cached boards. */
  invalidate() {
    this.cache.clear();
  }
}
