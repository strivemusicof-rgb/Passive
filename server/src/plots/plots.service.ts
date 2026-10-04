import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import type { BuyPlotResponse, MapPlotsResponse, PlotDto, Rarity, UpgradeResponse } from '@landrush/shared';
import { cellAt, cellCenter, cellKey, cellsInBox, neighbours, type Cell, type CellBounds } from '@landrush/shared/grid';

import { EconomyService, type Economy } from '../economy/economy.service.js';
import { plotIncomePerDay } from '../economy/income.js';
import { hotspotBoost, plotPrice, rarityOdds, rollRarity } from '../economy/rarity.js';
import { Prisma } from '../generated/prisma/client.js';
import { IncomeService, ownedNeighbours } from '../income/income.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WalletService, type Tx } from '../wallet/wallet.service.js';

const withOwner = { owner: { select: { id: true, displayName: true } } } as const;
type OwnedRow = Prisma.PlotGetPayload<{ include: typeof withOwner }>;

/** Free cells are listed only for small areas (zoomed-in map). */
const MAX_FREE_CELLS = 900;
/** How many rings around the player to search for a free starter plot. */
const STARTER_SEARCH_RINGS = 6;

@Injectable()
export class PlotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
    private readonly wallet: WalletService,
    private readonly income: IncomeService,
  ) {}

  async map(bounds: CellBounds, viewerId: string): Promise<MapPlotsResponse> {
    const economy = await this.economy.get();
    const cells = cellsInBox(bounds, MAX_FREE_CELLS + 1);
    const rows = await this.ownedInBox(bounds);
    // Neighbour bonus from the plots in view (close enough for the map).
    const keysByOwner = new Map<string, Set<string>>();
    for (const p of rows) {
      if (!keysByOwner.has(p.ownerId)) keysByOwner.set(p.ownerId, new Set());
      keysByOwner.get(p.ownerId)!.add(cellKey(p));
    }
    const owned = rows.map((p) => this.ownedDto(p, viewerId, economy, ownedNeighbours(p, keysByOwner.get(p.ownerId)!)));
    if (cells.length > MAX_FREE_CELLS) return { owned, free: [] };
    const ownedCount = await this.prisma.plot.count({ where: { ownerId: viewerId } });
    const taken = new Set(rows.map((p) => cellKey(p)));
    const free = cells.filter((c) => !taken.has(cellKey(c))).map((c) => this.freeDto(c, ownedCount, economy));
    return { owned, free };
  }

  async one(cell: Cell, viewerId: string): Promise<PlotDto> {
    const economy = await this.economy.get();
    const row = await this.prisma.plot.findUnique({ where: { row_col: cell }, include: withOwner });
    if (row) return this.ownedDto(row, viewerId, economy, await this.neighbourCount(this.prisma, row));
    const ownedCount = await this.prisma.plot.count({ where: { ownerId: viewerId } });
    return this.freeDto(cell, ownedCount, economy);
  }

  async mine(userId: string): Promise<PlotDto[]> {
    const economy = await this.economy.get();
    const rows = await this.prisma.plot.findMany({
      where: { ownerId: userId },
      include: withOwner,
      orderBy: { acquiredAt: 'desc' },
    });
    const keys = new Set(rows.map((p) => cellKey(p)));
    return rows.map((p) => this.ownedDto(p, userId, economy, ownedNeighbours(p, keys)));
  }

  buy(userId: string, cell: Cell): Promise<BuyPlotResponse> {
    return this.acquire(userId, cell, false);
  }

  /** The free first plot: the free cell closest to where the player is standing. */
  async claimStarter(userId: string, lat: number, lng: number): Promise<BuyPlotResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.starterClaimed) throw new ConflictException({ code: 'starter_already_claimed' });
    const centre = cellAt(lat, lng);
    for (let ring = 0; ring <= STARTER_SEARCH_RINGS; ring++) {
      const candidates = ringCells(centre, ring);
      const taken = await this.prisma.plot.findMany({
        where: { OR: candidates.map((c) => ({ row: c.row, col: c.col })) },
        select: { row: true, col: true },
      });
      const takenKeys = new Set(taken.map((t) => cellKey(t)));
      for (const c of candidates) {
        if (takenKeys.has(cellKey(c))) continue;
        try {
          return await this.acquire(userId, c, true);
        } catch (e) {
          // Someone took it a moment ago: try the next cell.
          if (e instanceof ConflictException && (e.getResponse() as { code?: string }).code === 'plot_taken') continue;
          throw e;
        }
      }
    }
    throw new BadRequestException({ code: 'no_free_plot_nearby' });
  }

  /** Builds the next building level on one of the player's plots. */
  async upgrade(userId: string, cell: Cell): Promise<UpgradeResponse> {
    const economy = await this.economy.get();
    return this.prisma.$transaction(async (tx) => {
      await this.income.lock(tx, userId);
      const plot = await tx.plot.findUnique({ where: { row_col: cell } });
      if (!plot || plot.ownerId !== userId) throw new ForbiddenException({ code: 'not_your_plot' });
      const next = plot.buildingLevel + 1;
      if (next >= economy.buildingCost.length) throw new BadRequestException({ code: 'max_level' });
      // Collect at the old rate first, so the new building never earns for the past.
      await this.income.collect(tx, userId);
      const wallet = await this.wallet.change(tx, userId, 'coins', -economy.buildingCost[next], 'building_upgrade', cellKey(cell));
      const updated = await tx.plot.update({ where: { row_col: cell }, data: { buildingLevel: next }, include: withOwner });
      return {
        plot: this.ownedDto(updated, userId, economy, await this.neighbourCount(tx, updated)),
        wallet,
        income: await this.income.summary(userId, tx),
      };
    });
  }

  /**
   * Buys (or, for the starter plot, claims) a free cell in one transaction:
   * collect what's waiting (so the new plot and its neighbour bonus don't pay
   * for the past), roll the rarity with the odds shown to the player, insert
   * the plot (fails if taken), take payment (fails if too poor), write the
   * ledger. Any failure rolls everything back.
   */
  private async acquire(userId: string, cell: Cell, starter: boolean): Promise<BuyPlotResponse> {
    const economy = await this.economy.get();
    const rarity = rollRarity(rarityOdds(cell, economy));
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.income.lock(tx, userId);
        let { wallet } = await this.income.collect(tx, userId);
        const ownedCount = await tx.plot.count({ where: { ownerId: userId } });
        const plot = await tx.plot.create({
          data: { row: cell.row, col: cell.col, ownerId: userId, rarity },
          include: withOwner,
        });
        if (starter) {
          const { count } = await tx.user.updateMany({
            where: { id: userId, starterClaimed: false },
            data: { starterClaimed: true },
          });
          if (count !== 1) throw new ConflictException({ code: 'starter_already_claimed' });
        } else {
          wallet = await this.wallet.change(tx, userId, 'coins', -plotPrice(ownedCount, economy), 'plot_purchase', cellKey(cell));
        }
        return {
          plot: this.ownedDto(plot, userId, economy, await this.neighbourCount(tx, plot)),
          wallet,
          income: await this.income.summary(userId, tx),
        };
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({ code: 'plot_taken' });
      }
      throw e;
    }
  }

  private async neighbourCount(db: Tx, plot: { row: number; col: number; ownerId: string }): Promise<number> {
    return db.plot.count({
      where: { ownerId: plot.ownerId, OR: neighbours(plot).map((n) => ({ row: n.row, col: n.col })) },
    });
  }

  private async ownedInBox(b: CellBounds): Promise<OwnedRow[]> {
    const sw = cellAt(b.south, b.west);
    const ne = cellAt(b.north, b.east);
    // Column widths vary slightly by row: query a safe column range, then trim.
    const rows = await this.prisma.plot.findMany({
      where: {
        row: { gte: sw.row, lte: ne.row },
        col: { gte: Math.min(sw.col, cellAt(b.north, b.west).col) - 1, lte: Math.max(ne.col, cellAt(b.south, b.east).col) + 1 },
      },
      include: withOwner,
      take: 2000,
    });
    return rows.filter((p) => {
      const c = cellCenter(p);
      return c.lat >= b.south && c.lat <= b.north && c.lng >= b.west && c.lng <= b.east;
    });
  }

  private ownedDto(p: OwnedRow, viewerId: string, economy: Economy, neighbourCount: number): PlotDto {
    const { lat, lng } = cellCenter(p);
    const rarity = p.rarity as Rarity;
    const mine = p.ownerId === viewerId;
    const next = p.buildingLevel + 1;
    return {
      key: cellKey(p),
      row: p.row,
      col: p.col,
      number: p.number,
      lat,
      lng,
      rarity,
      odds: null,
      boosted: false,
      owner: p.owner,
      mine,
      buildingLevel: p.buildingLevel,
      incomePerDay: plotIncomePerDay({ rarity, buildingLevel: p.buildingLevel, neighbours: neighbourCount }, economy),
      neighbours: neighbourCount,
      nextLevel:
        mine && next < economy.buildingCost.length
          ? {
              level: next,
              cost: economy.buildingCost[next],
              incomePerDay: plotIncomePerDay({ rarity, buildingLevel: next, neighbours: neighbourCount }, economy),
            }
          : null,
      price: null,
      name: p.name,
    };
  }

  private freeDto(cell: Cell, ownedCount: number, economy: Economy): PlotDto {
    const { lat, lng } = cellCenter(cell);
    return {
      key: cellKey(cell),
      row: cell.row,
      col: cell.col,
      number: null,
      lat,
      lng,
      rarity: null,
      odds: rarityOdds(cell, economy),
      boosted: hotspotBoost(cell, economy) > 0,
      owner: null,
      mine: false,
      buildingLevel: 0,
      incomePerDay: 0,
      neighbours: 0,
      nextLevel: null,
      price: plotPrice(ownedCount, economy),
      name: null,
    };
  }
}

/** Cells on the square ring `ring` steps around `centre` (ring 0 = the centre). */
function ringCells(centre: Cell, ring: number): Cell[] {
  if (ring === 0) return [centre];
  const out: Cell[] = [];
  for (let dr = -ring; dr <= ring; dr++) {
    for (let dc = -ring; dc <= ring; dc++) {
      if (Math.max(Math.abs(dr), Math.abs(dc)) === ring) out.push({ row: centre.row + dr, col: centre.col + dc });
    }
  }
  return out;
}
