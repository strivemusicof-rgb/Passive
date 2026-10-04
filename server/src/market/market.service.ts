import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RARITIES, type ListingDto, type MarketBuyResponse, type MarketResponse, type MarketSort, type MyMarketResponse, type Rarity } from '@landrush/shared';
import { cellKey, type Cell } from '@landrush/shared/grid';
import { z } from 'zod';

import { EconomyService, type Economy } from '../economy/economy.service.js';
import { plotValue, priceRange } from '../economy/rarity.js';
import { Prisma } from '../generated/prisma/client.js';
import { IncomeService, ownedNeighbours } from '../income/income.service.js';
import { PlotsService, withOwner } from '../plots/plots.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { nextResets } from '../progress/periods.js';
import { TrackerService } from '../progress/tracker.service.js';
import { WalletService } from '../wallet/wallet.service.js';

const DAY_MS = 86_400_000;
/** Listings considered when sorting/filtering (enough for a city-sized market). */
const SCAN_LIMIT = 500;
const PAGE = 50;

export const ListBody = z.object({ price: z.number().int().positive().max(1_000_000_000) });
export const MarketQuery = z.object({
  sort: z.enum(['newest', 'cheapest', 'income', 'rarity']).default('newest'),
  rarity: z.enum(RARITIES as unknown as [Rarity, ...Rarity[]]).optional(),
  q: z.string().trim().max(40).optional(),
  favourites: z.enum(['1', 'true']).optional(),
});

const withPlot = {
  plot: { include: withOwner },
  seller: { select: { id: true, displayName: true } },
  buyer: { select: { id: true, displayName: true } },
} as const;
type ListingRow = Prisma.ListingGetPayload<{ include: typeof withPlot }>;

@Injectable()
export class MarketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
    private readonly wallet: WalletService,
    private readonly income: IncomeService,
    private readonly plots: PlotsService,
    private readonly tracker: TrackerService,
  ) {}

  /** GET /market: active listings, newest first unless sorted otherwise. */
  async browse(viewerId: string, query: z.infer<typeof MarketQuery>): Promise<MarketResponse> {
    const economy = await this.economy.get();
    const q = query.q?.replace(/^#/, '');
    const number = q && /^\d+$/.test(q) ? Number(q) : undefined;
    const favourites = query.favourites
      ? await this.prisma.favourite.findMany({ where: { userId: viewerId }, select: { row: true, col: true } })
      : null;
    const rows = await this.prisma.listing.findMany({
      where: {
        status: 'active',
        ...(query.rarity ? { plot: { rarity: query.rarity } } : {}),
        ...(q ? (number !== undefined ? { plot: { number } } : { seller: { displayName: { contains: q, mode: 'insensitive' } } }) : {}),
        ...(favourites ? { OR: favourites.length ? favourites.map((f) => ({ row: f.row, col: f.col })) : [{ row: -1, col: -1 }] } : {}),
      },
      include: withPlot,
      orderBy: { createdAt: 'desc' },
      take: SCAN_LIMIT,
    });
    let listings = await this.toDtos(rows, viewerId, economy);
    const rank = (r: Rarity | null) => RARITIES.indexOf(r ?? 'common');
    const sorters: Record<MarketSort, (a: ListingDto, b: ListingDto) => number> = {
      newest: () => 0,
      cheapest: (a, b) => a.price - b.price,
      income: (a, b) => b.plot.incomePerDay - a.plot.incomePerDay,
      rarity: (a, b) => rank(b.plot.rarity) - rank(a.plot.rarity) || a.price - b.price,
    };
    listings = listings.sort(sorters[query.sort]).slice(0, PAGE);
    return { listings, feeRate: economy.market.feeRate };
  }

  /** GET /market/mine */
  async mine(userId: string): Promise<MyMarketResponse> {
    const economy = await this.economy.get();
    const [active, history] = await Promise.all([
      this.prisma.listing.findMany({ where: { sellerId: userId, status: 'active' }, include: withPlot, orderBy: { createdAt: 'desc' } }),
      this.prisma.listing.findMany({
        where: { status: 'sold', OR: [{ sellerId: userId }, { buyerId: userId }] },
        include: withPlot,
        orderBy: { closedAt: 'desc' },
        take: 30,
      }),
    ]);
    return { active: await this.toDtos(active, userId, economy), history: await this.toDtos(history, userId, economy) };
  }

  /** POST /plots/:key/list */
  async list(userId: string, cell: Cell, price: number): Promise<ListingDto> {
    const economy = await this.economy.get();
    const { market } = economy;
    const id = await this.prisma.$transaction(async (tx) => {
      await this.income.lock(tx, userId);
      const plot = await tx.plot.findUnique({ where: { row_col: cell } });
      if (!plot || plot.ownerId !== userId) throw new ForbiddenException({ code: 'not_your_plot' });
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (Date.now() - user.createdAt.getTime() < market.minAccountAgeDays * DAY_MS) {
        throw new BadRequestException({ code: 'account_too_new_to_sell', days: market.minAccountAgeDays });
      }
      const range = priceRange(plotValue(plot.rarity as Rarity, plot.buildingLevel, economy), economy);
      if (price < range.min || price > range.max) throw new BadRequestException({ code: 'price_out_of_range', ...range });
      if ((await tx.listing.count({ where: { sellerId: userId, status: 'active' } })) >= market.maxActiveListings) {
        throw new BadRequestException({ code: 'too_many_listings' });
      }
      try {
        return (await tx.listing.create({ data: { row: cell.row, col: cell.col, sellerId: userId, price } })).id;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException({ code: 'already_listed' });
        throw e;
      }
    });
    return this.one(id, userId);
  }

  /** POST /market/:id/cancel */
  async cancel(userId: string, id: string): Promise<ListingDto> {
    const { count } = await this.prisma.listing.updateMany({
      where: { id, sellerId: userId, status: 'active' },
      data: { status: 'cancelled', closedAt: new Date() },
    });
    if (count !== 1) {
      const listing = await this.prisma.listing.findUnique({ where: { id } });
      if (!listing || listing.sellerId !== userId) throw new NotFoundException();
      throw new ConflictException({ code: 'listing_closed' });
    }
    return this.one(id, userId);
  }

  /**
   * POST /market/:id/buy. Both players' income is collected first (the plot
   * moves and neighbour bonuses change), then coins and the plot change hands.
   */
  async buy(buyerId: string, id: string, now = new Date()): Promise<MarketBuyResponse> {
    const economy = await this.economy.get();
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException();
    if (listing.sellerId === buyerId) throw new BadRequestException({ code: 'own_listing' });

    return this.prisma.$transaction(async (tx) => {
      // Lock both wallets in a fixed order so two trades can't deadlock.
      for (const userId of [buyerId, listing.sellerId].sort()) await this.income.lock(tx, userId);
      const dayStart = new Date(new Date(nextResets(now).daily).getTime() - DAY_MS);
      if ((await tx.listing.count({ where: { buyerId, closedAt: { gte: dayStart } } })) >= economy.market.maxBuysPerDay) {
        throw new BadRequestException({ code: 'market_buy_limit' });
      }
      const fee = Math.round(listing.price * economy.market.feeRate);
      const { count } = await tx.listing.updateMany({
        where: { id, status: 'active' },
        data: { status: 'sold', buyerId, fee, closedAt: now },
      });
      if (count !== 1) throw new ConflictException({ code: 'listing_closed' });
      const plot = await tx.plot.findUnique({ where: { row_col: { row: listing.row, col: listing.col } } });
      if (!plot || plot.ownerId !== listing.sellerId) throw new ConflictException({ code: 'listing_closed' });

      await this.income.collect(tx, buyerId, now);
      await this.income.collect(tx, listing.sellerId, now);
      // Throws insufficient_funds (and rolls everything back) if the buyer can't pay.
      await this.wallet.change(tx, buyerId, 'coins', -listing.price, 'market_buy', id);
      await this.wallet.change(tx, listing.sellerId, 'coins', listing.price - fee, 'market_sale', id);
      const moved = await tx.plot.update({
        where: { row_col: { row: listing.row, col: listing.col } },
        data: { ownerId: buyerId, collectedAt: now, acquiredAt: now, name: null },
        include: withOwner,
      });
      await this.tracker.track(tx, buyerId, 'buyPlot', 1, now);
      return {
        plot: this.plots.ownedDto(moved, buyerId, economy, await this.plots.neighbourCount(tx, moved)),
        wallet: await this.wallet.ensure(tx, buyerId),
        income: await this.income.summary(buyerId, tx),
      };
    });
  }

  async setFavourite(userId: string, cell: Cell, on: boolean): Promise<{ favourite: boolean }> {
    if (on) {
      await this.prisma.favourite.upsert({
        where: { userId_row_col: { userId, row: cell.row, col: cell.col } },
        create: { userId, row: cell.row, col: cell.col },
        update: {},
      });
    } else {
      await this.prisma.favourite.deleteMany({ where: { userId, row: cell.row, col: cell.col } });
    }
    return { favourite: on };
  }

  async isFavourite(userId: string, cell: Cell): Promise<boolean> {
    return !!(await this.prisma.favourite.findUnique({ where: { userId_row_col: { userId, row: cell.row, col: cell.col } } }));
  }

  private async one(id: string, viewerId: string): Promise<ListingDto> {
    const row = await this.prisma.listing.findUniqueOrThrow({ where: { id }, include: withPlot });
    return (await this.toDtos([row], viewerId, await this.economy.get()))[0];
  }

  private async toDtos(rows: ListingRow[], viewerId: string, economy: Economy): Promise<ListingDto[]> {
    if (rows.length === 0) return [];
    const ownerIds = [...new Set(rows.map((r) => r.plot.ownerId))];
    const [owned, favs] = await Promise.all([
      this.prisma.plot.findMany({ where: { ownerId: { in: ownerIds } }, select: { row: true, col: true, ownerId: true } }),
      this.prisma.favourite.findMany({ where: { userId: viewerId, OR: rows.map((r) => ({ row: r.row, col: r.col })) } }),
    ]);
    const keysByOwner = new Map<string, Set<string>>();
    for (const p of owned) {
      if (!keysByOwner.has(p.ownerId)) keysByOwner.set(p.ownerId, new Set());
      keysByOwner.get(p.ownerId)!.add(cellKey(p));
    }
    const favKeys = new Set(favs.map((f) => cellKey(f)));
    return rows.map((r) => ({
      id: r.id,
      price: r.price,
      fee: r.fee,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      closedAt: r.closedAt?.toISOString() ?? null,
      seller: r.seller,
      buyer: r.buyer,
      mine: r.sellerId === viewerId,
      favourite: favKeys.has(cellKey(r)),
      plot: this.plots.ownedDto(r.plot, viewerId, economy, ownedNeighbours(r.plot, keysByOwner.get(r.plot.ownerId) ?? new Set())),
    }));
  }
}
