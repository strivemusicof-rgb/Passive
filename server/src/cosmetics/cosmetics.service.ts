import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { CosmeticBuyResponse, CosmeticsResponse, PlotDto, UserDto } from '@landrush/shared';
import { COSMETICS, cosmetic, type CosmeticType } from '@landrush/shared/cosmetics';
import { type Cell } from '@landrush/shared/grid';
import { z } from 'zod';

import { EconomyService } from '../economy/economy.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { IncomeService } from '../income/income.service.js';
import { PlotsService, withOwner } from '../plots/plots.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toUserDto } from '../users/users.service.js';
import { WalletService } from '../wallet/wallet.service.js';

const itemId = z.string().max(40).nullable().optional();
export const UserStyleBody = z.object({ nameColor: itemId, avatarFrame: itemId });
export const PlotStyleBody = z.object({ skin: itemId, flag: itemId });

/**
 * Cosmetics: bought once with gems or coins, then equipped (name colour,
 * avatar frame) or put on any of your plots (skin, flag). Looks only.
 */
@Injectable()
export class CosmeticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
    private readonly wallet: WalletService,
    private readonly income: IncomeService,
    private readonly plots: PlotsService,
  ) {}

  async list(userId: string): Promise<CosmeticsResponse> {
    const [owned, user] = await Promise.all([
      this.prisma.userCosmetic.findMany({ where: { userId }, select: { itemId: true } }),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { nameColor: true, avatarFrame: true } }),
    ]);
    const ownedIds = new Set(owned.map((o) => o.itemId));
    return {
      items: COSMETICS.map((c) => ({
        id: c.id,
        type: c.type,
        value: c.value,
        accent: c.accent ?? null,
        gems: c.gems ?? null,
        coins: c.coins ?? null,
        owned: ownedIds.has(c.id),
      })),
      equipped: { nameColor: user.nameColor, avatarFrame: user.avatarFrame },
    };
  }

  async buy(userId: string, id: string): Promise<CosmeticBuyResponse> {
    const item = cosmetic(id);
    if (!item) throw new NotFoundException({ code: 'unknown_item' });
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.income.lock(tx, userId);
        // Insert first: the primary key stops buying the same item twice.
        await tx.userCosmetic.create({ data: { userId, itemId: item.id } });
        if (item.gems) await this.wallet.change(tx, userId, 'gems', -item.gems, 'cosmetic', item.id);
        else if (item.coins) await this.wallet.change(tx, userId, 'coins', -item.coins, 'cosmetic', item.id);
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException({ code: 'already_owned' });
      throw e;
    }
    return { ...(await this.list(userId)), wallet: await this.wallet.get(userId) };
  }

  /** POST /me/style: equip (item id) or take off (null) a name colour / frame. */
  async setUserStyle(userId: string, body: z.infer<typeof UserStyleBody>): Promise<UserDto> {
    const data: { nameColor?: string | null; avatarFrame?: string | null } = {};
    if (body.nameColor !== undefined) data.nameColor = await this.ownedOrNull(userId, body.nameColor, 'nameColor');
    if (body.avatarFrame !== undefined) data.avatarFrame = await this.ownedOrNull(userId, body.avatarFrame, 'avatarFrame');
    return toUserDto(await this.prisma.user.update({ where: { id: userId }, data }));
  }

  /** POST /plots/:key/style: put an owned skin / flag on one of your plots (null removes it). */
  async setPlotStyle(userId: string, cell: Cell, body: z.infer<typeof PlotStyleBody>): Promise<PlotDto> {
    const plot = await this.prisma.plot.findUnique({ where: { row_col: cell } });
    if (!plot || plot.ownerId !== userId) throw new ForbiddenException({ code: 'not_your_plot' });
    const data: { skin?: string | null; flag?: string | null } = {};
    if (body.skin !== undefined) data.skin = await this.ownedOrNull(userId, body.skin, 'plotSkin');
    if (body.flag !== undefined) data.flag = await this.ownedOrNull(userId, body.flag, 'plotFlag');
    const updated = await this.prisma.plot.update({ where: { row_col: cell }, data, include: withOwner });
    return this.plots.ownedDto(updated, userId, await this.economy.get(), await this.plots.neighbourCount(this.prisma, updated));
  }

  private async ownedOrNull(userId: string, id: string | null | undefined, type: CosmeticType): Promise<string | null> {
    if (!id) return null;
    if (!cosmetic(id, type)) throw new BadRequestException({ code: 'unknown_item' });
    const owned = await this.prisma.userCosmetic.findUnique({ where: { userId_itemId: { userId, itemId: id } } });
    if (!owned) throw new ForbiddenException({ code: 'not_owned' });
    return id;
  }
}
