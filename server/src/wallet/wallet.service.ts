import { BadRequestException, Injectable } from '@nestjs/common';
import type { WalletDto } from '@landrush/shared';

import { EconomyService } from '../economy/economy.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type Tx = Prisma.TransactionClient;
export type CurrencyName = 'coins' | 'gems';

/**
 * The only place that changes balances. Every change is a conditional
 * update (never below zero) plus a ledger row, inside the caller's
 * transaction.
 */
@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
  ) {}

  async get(userId: string): Promise<WalletDto> {
    return this.prisma.$transaction((tx) => this.ensure(tx, userId));
  }

  /** Creates the wallet with the welcome bonus the first time it's needed. */
  async ensure(tx: Tx, userId: string): Promise<WalletDto> {
    const existing = await tx.wallet.findUnique({ where: { userId } });
    if (existing) return { coins: existing.coins, gems: existing.gems };
    const { welcomeCoins, welcomeGems } = await this.economy.get();
    // ON CONFLICT: two first requests at once must not both pay the bonus.
    const created = await tx.$queryRaw<{ coins: number; gems: number }[]>`
      INSERT INTO wallets (user_id, coins, gems, updated_at)
      VALUES (${userId}::uuid, ${welcomeCoins}, ${welcomeGems}, now())
      ON CONFLICT (user_id) DO NOTHING
      RETURNING coins, gems`;
    if (created.length === 0) {
      const w = await tx.wallet.findUniqueOrThrow({ where: { userId } });
      return { coins: w.coins, gems: w.gems };
    }
    await tx.transaction.createMany({
      data: [
        { userId, currency: 'coins', amount: welcomeCoins, balanceAfter: welcomeCoins, type: 'welcome_bonus' },
        { userId, currency: 'gems', amount: welcomeGems, balanceAfter: welcomeGems, type: 'welcome_bonus' },
      ],
    });
    return created[0];
  }

  /** Adds (positive) or spends (negative). Throws insufficient_funds instead of going below zero. */
  async change(tx: Tx, userId: string, currency: CurrencyName, amount: number, type: string, ref?: string): Promise<WalletDto> {
    await this.ensure(tx, userId);
    const rows =
      currency === 'coins'
        ? await tx.$queryRaw<{ coins: number; gems: number }[]>`
            UPDATE wallets SET coins = coins + ${amount}, updated_at = now()
            WHERE user_id = ${userId}::uuid AND coins + ${amount} >= 0
            RETURNING coins, gems`
        : await tx.$queryRaw<{ coins: number; gems: number }[]>`
            UPDATE wallets SET gems = gems + ${amount}, updated_at = now()
            WHERE user_id = ${userId}::uuid AND gems + ${amount} >= 0
            RETURNING coins, gems`;
    if (rows.length === 0) throw new BadRequestException({ code: 'insufficient_funds' });
    const wallet = rows[0];
    await tx.transaction.create({
      data: { userId, currency, amount, balanceAfter: wallet[currency], type, ref },
    });
    return wallet;
  }
}
