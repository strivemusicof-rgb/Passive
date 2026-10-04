import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AdPlacement, AdRewardResponse, AdsDto } from '@landrush/shared';
import { z } from 'zod';

import { EconomyService, type Economy } from '../economy/economy.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { IncomeService } from '../income/income.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { nextResets } from '../progress/periods.js';
import { RewardsService } from '../rewards/rewards.service.js';
import { WalletService, type Tx } from '../wallet/wallet.service.js';
import { AdmobVerifier } from './admob.verifier.js';

const DAY_MS = 86_400_000;

export const AdStartBody = z.object({ placement: z.enum(['collect2x', 'bonus']) });

const dayStart = (now: Date) => new Date(new Date(nextResets(now).daily).getTime() - DAY_MS);

@Injectable()
export class AdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
    private readonly wallet: WalletService,
    private readonly income: IncomeService,
    private readonly rewards: RewardsService,
    private readonly admob: AdmobVerifier,
  ) {}

  /** GET /ads: what the player can watch right now. */
  async status(userId: string, db: Tx = this.prisma, now = new Date()): Promise<AdsDto> {
    const { ads } = await this.economy.get();
    const [watched, last, toDouble] = await Promise.all([
      this.watchedToday(db, userId, now),
      db.adView.findFirst({ where: { userId, rewardedAt: { not: null } }, orderBy: { rewardedAt: 'desc' }, select: { rewardedAt: true } }),
      this.collectToDouble(db, userId, ads, now),
    ]);
    const cooldownEnd = last?.rewardedAt ? last.rewardedAt.getTime() + ads.cooldownSec * 1000 : 0;
    return {
      enabled: ads.enabled,
      remainingToday: Math.max(0, ads.maxPerDay - watched),
      maxPerDay: ads.maxPerDay,
      cooldownUntil: cooldownEnd > now.getTime() ? new Date(cooldownEnd).toISOString() : null,
      collect2x: toDouble ? { coins: Math.min(toDouble.amount, ads.collect2x.maxCoins) } : null,
      bonus: { coins: ads.bonus.coins, points: ads.bonus.points },
    };
  }

  /** POST /ads/start: called right before the app shows an ad. */
  async start(userId: string, placement: AdPlacement, now = new Date()): Promise<{ id: string }> {
    const { ads } = await this.economy.get();
    if (!ads.enabled) throw new BadRequestException({ code: 'ads_disabled' });
    return this.prisma.$transaction(async (tx) => {
      await this.income.lock(tx, userId);
      await this.checkLimits(tx, userId, ads, now);
      if (placement === 'collect2x') {
        const collect = await this.collectToDouble(tx, userId, ads, now);
        if (!collect) throw new BadRequestException({ code: 'nothing_to_double' });
        const ref = String(collect.id);
        // Started before but the ad was closed early: use the same one again.
        const existing = await tx.adView.findUnique({ where: { placement_ref: { placement, ref } } });
        if (existing) return { id: existing.id };
        const view = await tx.adView.create({ data: { userId, placement, ref, coins: Math.min(collect.amount, ads.collect2x.maxCoins) } });
        return { id: view.id };
      }
      const view = await tx.adView.create({ data: { userId, placement, coins: ads.bonus.coins } });
      return { id: view.id };
    });
  }

  /**
   * POST /ads/:id/complete: the app says the ad was watched. With SSV on, only
   * Google's callback pays, so this just reports whether it has arrived yet.
   */
  async complete(userId: string, id: string): Promise<AdRewardResponse> {
    const { ads } = await this.economy.get();
    const view = await this.prisma.adView.findFirst({ where: { id, userId } });
    if (!view) throw new NotFoundException();
    if (!view.rewardedAt && !ads.requireSsv) await this.grant(id, userId);
    return this.result(userId, id);
  }

  /** GET /ads/ssv: Google's server-side verification callback. */
  async ssv(rawQuery: string): Promise<boolean> {
    const cb = await this.admob.verify(rawQuery);
    if (!cb) return false;
    // A valid callback we can't match (e.g. Google's console test) is still a 200.
    if (!z.uuid().safeParse(cb.customData).success) return true;
    const view = await this.prisma.adView.findUnique({ where: { id: cb.customData } });
    if (!view || view.userId !== cb.userId) return true;
    await this.grant(view.id, view.userId, cb.transactionId || undefined);
    return true;
  }

  /** Pays an ad once. Safe to call twice (app + Google): only the first one pays. */
  private async grant(id: string, userId: string, admobTxId?: string): Promise<void> {
    const economy = await this.economy.get();
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.income.lock(tx, userId);
        const view = await tx.adView.findUniqueOrThrow({ where: { id } });
        if (view.rewardedAt) return;
        const overLimit = (await this.watchedToday(tx, userId, new Date())) >= economy.ads.maxPerDay;
        await tx.adView.update({ where: { id }, data: { rewardedAt: new Date(), admobTxId, coins: overLimit ? 0 : view.coins } });
        if (overLimit) return;
        if (view.coins > 0) await this.wallet.change(tx, userId, 'coins', view.coins, 'ad_reward', id);
        if (view.placement === 'bonus') {
          const points = await this.rewards.award(tx, userId, economy.ads.bonus.points, 'ad', id);
          if (points > 0) await tx.adView.update({ where: { id }, data: { points } });
        }
      });
    } catch (e) {
      // Google sent the same transaction twice: already paid.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return;
      throw e;
    }
  }

  private async result(userId: string, id: string): Promise<AdRewardResponse> {
    const view = await this.prisma.adView.findUniqueOrThrow({ where: { id } });
    const wallet = await this.prisma.$transaction((tx) => this.wallet.ensure(tx, userId));
    return {
      status: view.rewardedAt ? 'rewarded' : 'pending',
      coins: view.rewardedAt ? view.coins : 0,
      points: view.points,
      wallet,
      ads: await this.status(userId),
    };
  }

  private async checkLimits(tx: Tx, userId: string, ads: Economy['ads'], now: Date) {
    if ((await this.watchedToday(tx, userId, now)) >= ads.maxPerDay) throw new BadRequestException({ code: 'ads_limit' });
    const last = await tx.adView.findFirst({ where: { userId, rewardedAt: { not: null } }, orderBy: { rewardedAt: 'desc' } });
    if (last?.rewardedAt && now.getTime() - last.rewardedAt.getTime() < ads.cooldownSec * 1000) {
      throw new ConflictException({ code: 'ads_cooldown' });
    }
  }

  private watchedToday(db: Tx, userId: string, now: Date) {
    return db.adView.count({ where: { userId, rewardedAt: { gte: dayStart(now) } } });
  }

  /** The player's latest collect, if it's recent and hasn't been doubled. */
  private async collectToDouble(db: Tx, userId: string, ads: Economy['ads'], now: Date) {
    const collect = await db.transaction.findFirst({
      where: { userId, type: 'collect', createdAt: { gte: new Date(now.getTime() - ads.collect2x.withinMinutes * 60_000) } },
      orderBy: { id: 'desc' },
      select: { id: true, amount: true },
    });
    if (!collect || collect.amount <= 0) return null;
    const done = await db.adView.findFirst({ where: { placement: 'collect2x', ref: String(collect.id), rewardedAt: { not: null } } });
    return done ? null : collect;
  }
}
