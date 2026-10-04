import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CashoutRequestDto, RewardsDto } from '@landrush/shared';
import { z } from 'zod';

import { EconomyService, type Economy } from '../economy/economy.service.js';
import { Prisma, type CashoutRequest } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { nextResets } from '../progress/periods.js';
import { WalletService, type Tx } from '../wallet/wallet.service.js';

/** Ledger types that count as "earned from free play" for the daily cap. */
const EARN_TYPES = ['points_check_in', 'points_streak', 'points_weekly_mission', 'points_level_up', 'points_land'];
const DAY_MS = 86_400_000;

export const CashoutBody = z.object({
  method: z.string().min(1).max(30),
  destination: z.email().max(254),
});

function toDto(r: CashoutRequest): CashoutRequestDto {
  return {
    id: r.id,
    points: r.points,
    eurCents: r.eurCents,
    method: r.method,
    destination: r.destination,
    status: r.status,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
  };
}

@Injectable()
export class RewardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
    private readonly wallet: WalletService,
  ) {}

  /** Rewards are on for everyone, or for listed testers (by user id or email). */
  async enabledFor(db: Tx, userId: string, economy?: Economy): Promise<boolean> {
    const { rewards } = economy ?? (await this.economy.get());
    if (rewards.enabled) return true;
    if (rewards.testers.length === 0) return false;
    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
    return !!user && (rewards.testers.includes(user.id) || (!!user.email && rewards.testers.includes(user.email)));
  }

  /**
   * Gives free-play points, respecting the daily cap. Call inside the
   * action's transaction (which already holds the player's wallet lock).
   * Returns how many points were actually given.
   */
  async award(
    tx: Tx,
    userId: string,
    amount: number,
    source: 'check_in' | 'streak' | 'weekly_mission' | 'level_up' | 'land',
    ref?: string,
  ): Promise<number> {
    if (amount <= 0) return 0;
    const economy = await this.economy.get();
    if (!(await this.enabledFor(tx, userId, economy))) return 0;
    let grant = Math.min(amount, economy.rewards.dailyCap - (await this.earnedToday(tx, userId)));
    if (source === 'land') grant = Math.min(grant, economy.rewards.earn.landDailyCap - (await this.earnedToday(tx, userId, ['points_land'])));
    if (grant <= 0) return 0;
    await this.wallet.change(tx, userId, 'points', grant, `points_${source}`, ref);
    return grant;
  }

  async summary(userId: string): Promise<RewardsDto> {
    const economy = await this.economy.get();
    const { rewards } = economy;
    const [enabled, wallet, user, todayEarned, todayLand, history, requests] = await Promise.all([
      this.enabledFor(this.prisma, userId, economy),
      this.prisma.$transaction((tx) => this.wallet.ensure(tx, userId)),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.earnedToday(this.prisma, userId),
      this.earnedToday(this.prisma, userId, ['points_land']),
      this.prisma.transaction.findMany({
        where: { userId, currency: 'points' },
        orderBy: { id: 'desc' },
        take: 20,
        select: { amount: true, type: true, createdAt: true },
      }),
      this.prisma.cashoutRequest.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);
    const pending = requests.some((r) => r.status === 'pending');
    return {
      enabled,
      points: wallet.points,
      pointsPerEuro: rewards.pointsPerEuro,
      minCashoutPoints: rewards.minCashoutPoints,
      todayEarned,
      todayLand,
      dailyCap: rewards.dailyCap,
      earn: rewards.earn,
      methods: rewards.methods,
      cashoutBlocked: !enabled
        ? 'rewards_disabled'
        : user.isGuest
          ? 'guest_cannot_cashout'
          : Date.now() - user.createdAt.getTime() < rewards.minAccountAgeDays * DAY_MS
            ? 'account_too_new'
            : pending
              ? 'cashout_pending'
              : wallet.points < rewards.minCashoutPoints
                ? 'not_enough_points'
                : null,
      history: history.map((h) => ({ amount: h.amount, type: h.type, createdAt: h.createdAt.toISOString() })),
      requests: requests.map(toDto),
    };
  }

  /**
   * Asks for a payout of all whole euros in the balance. The points are held
   * (taken from the wallet) right away and returned if the request is rejected.
   */
  async requestCashout(userId: string, body: z.infer<typeof CashoutBody>): Promise<RewardsDto> {
    const economy = await this.economy.get();
    const { rewards } = economy;
    if (!rewards.methods.includes(body.method)) throw new BadRequestException({ code: 'invalid_destination' });
    await this.prisma.$transaction(async (tx) => {
      await this.wallet.ensure(tx, userId);
      await tx.$queryRaw`SELECT 1 FROM wallets WHERE user_id = ${userId}::uuid FOR UPDATE`;
      if (!(await this.enabledFor(tx, userId, economy))) throw new BadRequestException({ code: 'rewards_disabled' });
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.isGuest) throw new BadRequestException({ code: 'guest_cannot_cashout' });
      if (Date.now() - user.createdAt.getTime() < rewards.minAccountAgeDays * DAY_MS) {
        throw new BadRequestException({ code: 'account_too_new' });
      }
      const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
      const points = Math.floor(wallet.points / rewards.pointsPerEuro) * rewards.pointsPerEuro;
      if (points < rewards.minCashoutPoints) throw new BadRequestException({ code: 'not_enough_points' });
      let request: CashoutRequest;
      try {
        request = await tx.cashoutRequest.create({
          data: {
            userId,
            points,
            eurCents: Math.round((points / rewards.pointsPerEuro) * 100),
            method: body.method,
            destination: body.destination.trim().toLowerCase(),
          },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new ConflictException({ code: 'cashout_pending' });
        }
        throw e;
      }
      await this.wallet.change(tx, userId, 'points', -points, 'cashout_hold', request.id);
    });
    return this.summary(userId);
  }

  // ------------------------------------------------------------ admin

  async adminList(status?: string) {
    const where = status ? { status: status as CashoutRequest['status'] } : {};
    const rows = await this.prisma.cashoutRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { id: true, displayName: true, email: true, appleSub: true, isGuest: true, createdAt: true, level: true } } },
    });
    // Warning signs for the reviewer.
    return Promise.all(
      rows.map(async (r) => {
        const [plots, checkIns, earned, sameDestination] = await Promise.all([
          this.prisma.plot.count({ where: { ownerId: r.userId } }),
          this.prisma.checkIn.count({ where: { userId: r.userId } }),
          this.prisma.transaction.aggregate({ where: { userId: r.userId, currency: 'points', amount: { gt: 0 }, type: { in: EARN_TYPES } }, _sum: { amount: true } }),
          this.prisma.cashoutRequest.findMany({ where: { destination: r.destination, userId: { not: r.userId } }, distinct: ['userId'], select: { userId: true } }),
        ]);
        const ageDays = Math.floor((Date.now() - r.user.createdAt.getTime()) / DAY_MS);
        const flags: string[] = [];
        if (sameDestination.length > 0) flags.push(`Same payout address used by ${sameDestination.length} other account(s)`);
        if (ageDays < 14) flags.push(`Account only ${ageDays} days old`);
        if (plots === 0) flags.push('Owns no plots');
        return {
          ...toDto(r),
          decidedAt: r.decidedAt?.toISOString() ?? null,
          user: {
            id: r.user.id,
            name: r.user.displayName,
            email: r.user.email,
            signIn: r.user.appleSub ? 'apple' : r.user.email ? 'email' : 'guest',
            ageDays,
            level: r.user.level,
            plots,
            checkIns,
            pointsEarned: earned._sum.amount ?? 0,
          },
          flags,
        };
      }),
    );
  }

  /** pending → approved → paid; pending/approved → rejected (points returned). */
  async adminDecide(id: string, action: 'approve' | 'paid' | 'reject', note?: string) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.cashoutRequest.findUnique({ where: { id } });
      if (!request) throw new NotFoundException();
      const from = action === 'approve' ? ['pending'] : action === 'paid' ? ['approved'] : ['pending', 'approved'];
      const to = action === 'approve' ? 'approved' : action === 'paid' ? 'paid' : 'rejected';
      const { count } = await tx.cashoutRequest.updateMany({
        where: { id, status: { in: from as CashoutRequest['status'][] } },
        data: { status: to, decidedAt: new Date(), note: action === 'reject' ? (note ?? null) : undefined },
      });
      if (count !== 1) throw new ConflictException({ error: `Request is ${request.status}` });
      if (action === 'reject') {
        await this.wallet.change(tx, request.userId, 'points', request.points, 'cashout_refund', request.id);
      }
      return { ok: true };
    });
  }

  async adminRewardsConfig() {
    return (await this.economy.get()).rewards;
  }

  async adminSetEnabled(enabled: boolean) {
    const current = (await this.economy.get()).rewards;
    await this.prisma.economyConfig.upsert({
      where: { key: 'rewards' },
      create: { key: 'rewards', value: { ...current, enabled } },
      update: { value: { ...current, enabled } },
    });
    this.economy.invalidate();
    return { enabled };
  }

  private async earnedToday(db: Tx, userId: string, types = EARN_TYPES): Promise<number> {
    const dayStart = new Date(new Date(nextResets(new Date()).daily).getTime() - DAY_MS);
    const sum = await db.transaction.aggregate({
      where: { userId, currency: 'points', type: { in: types }, createdAt: { gte: dayStart } },
      _sum: { amount: true },
    });
    return sum._sum.amount ?? 0;
  }
}
