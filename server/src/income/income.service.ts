import { BadRequestException, Injectable } from '@nestjs/common';
import type { IncomeDto, Rarity, WalletDto } from '@landrush/shared';
import { cellKey, neighbours, type Cell } from '@landrush/shared/grid';

import { EconomyService } from '../economy/economy.service.js';
import { pendingCoins, plotIncomePerDay, storageFullAt, storageHoursFor, type IncomePlot } from '../economy/income.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WalletService, type Tx } from '../wallet/wallet.service.js';

/** How many of a cell's 8 neighbours are in `ownedKeys`. */
export function ownedNeighbours(cell: Cell, ownedKeys: Set<string>): number {
  return neighbours(cell).filter((n) => ownedKeys.has(cellKey(n))).length;
}

@Injectable()
export class IncomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
    private readonly wallet: WalletService,
  ) {}

  /**
   * Serialises everything that touches one player's coins: two Collect taps
   * (or Collect + Buy) at once can't both pay out the same income.
   */
  async lock(tx: Tx, userId: string): Promise<void> {
    await this.wallet.ensure(tx, userId);
    await tx.$queryRaw`SELECT 1 FROM wallets WHERE user_id = ${userId}::uuid FOR UPDATE`;
  }

  /** Pays out everything waiting and restarts every plot's timer. Call inside a locked transaction. */
  async collect(tx: Tx, userId: string, now = new Date()): Promise<{ collected: number; wallet: WalletDto }> {
    const economy = await this.economy.get();
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { storageLevel: true } });
    const plots = await this.incomePlots(tx, userId);
    const collected = pendingCoins(plots, storageHoursFor(user.storageLevel, economy), now, economy);
    await tx.plot.updateMany({ where: { ownerId: userId }, data: { collectedAt: now } });
    const wallet =
      collected > 0
        ? await this.wallet.change(tx, userId, 'coins', collected, 'collect')
        : await this.wallet.ensure(tx, userId);
    return { collected, wallet };
  }

  /** POST /collect */
  async collectNow(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, userId);
      const res = await this.collect(tx, userId);
      return { ...res, income: await this.summary(userId, tx) };
    });
  }

  async upgradeStorage(userId: string) {
    const economy = await this.economy.get();
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, userId);
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      const next = user.storageLevel + 1;
      if (next >= economy.storageHours.length) throw new BadRequestException({ code: 'max_level' });
      // Collect at the old limit first, so the bigger storage isn't applied to the past.
      await this.collect(tx, userId);
      const wallet = await this.wallet.change(tx, userId, 'coins', -economy.storageCost[next], 'storage_upgrade', String(next));
      await tx.user.update({ where: { id: userId }, data: { storageLevel: next } });
      return { wallet, income: await this.summary(userId, tx) };
    });
  }

  async summary(userId: string, db: Tx = this.prisma): Promise<IncomeDto> {
    const economy = await this.economy.get();
    const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { storageLevel: true } });
    const plots = await this.incomePlots(db, userId);
    const hours = storageHoursFor(user.storageLevel, economy);
    const now = new Date();
    const nextLevel = user.storageLevel + 1;
    return {
      perDay: plots.reduce((sum, p) => sum + plotIncomePerDay(p, economy), 0),
      pending: pendingCoins(plots, hours, now, economy),
      storageLevel: user.storageLevel,
      storageHours: hours,
      fullAt: storageFullAt(plots, hours)?.toISOString() ?? null,
      serverTime: now.toISOString(),
      nextStorage:
        nextLevel < economy.storageHours.length
          ? { level: nextLevel, hours: economy.storageHours[nextLevel], cost: economy.storageCost[nextLevel] }
          : null,
      buildingCost: economy.buildingCost,
      buildingIncome: economy.buildingIncome,
    };
  }

  private async incomePlots(db: Tx, userId: string): Promise<IncomePlot[]> {
    const rows = await db.plot.findMany({
      where: { ownerId: userId },
      select: { row: true, col: true, rarity: true, buildingLevel: true, collectedAt: true },
    });
    const keys = new Set(rows.map((r) => cellKey(r)));
    return rows.map((r) => ({
      rarity: r.rarity as Rarity,
      buildingLevel: r.buildingLevel,
      collectedAt: r.collectedAt,
      neighbours: ownedNeighbours(r, keys),
    }));
  }
}

