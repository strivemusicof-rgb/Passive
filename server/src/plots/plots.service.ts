import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { BuyPlotResponse, MapPlotsResponse, PlotDto, Rarity } from '@landrush/shared';
import { cellAt, cellCenter, cellKey, cellsInBox, type Cell, type CellBounds } from '@landrush/shared/grid';

import { EconomyService, type Economy } from '../economy/economy.service.js';
import { hotspotBoost, plotIncome, plotPrice, rarityOdds, rollRarity } from '../economy/rarity.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WalletService } from '../wallet/wallet.service.js';

type OwnedRow = Prisma.PlotGetPayload<{ include: { owner: { select: { id: true; displayName: true } } } }>;

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
  ) {}

  async map(bounds: CellBounds, viewerId: string): Promise<MapPlotsResponse> {
    const economy = await this.economy.get();
    const cells = cellsInBox(bounds, MAX_FREE_CELLS + 1);
    const rows = await this.ownedInBox(bounds);
    const ownedKeys = new Set(rows.map((p) => cellKey(p)));
    const owned = rows.map((p) => this.ownedDto(p, viewerId, economy));
    if (cells.length > MAX_FREE_CELLS) return { owned, free: [] };
    const ownedCount = await this.prisma.plot.count({ where: { ownerId: viewerId } });
    const free = cells.filter((c) => !ownedKeys.has(cellKey(c))).map((c) => this.freeDto(c, ownedCount, economy));
    return { owned, free };
  }

  async one(cell: Cell, viewerId: string): Promise<PlotDto> {
    const economy = await this.economy.get();
    const row = await this.prisma.plot.findUnique({
      where: { row_col: cell },
      include: { owner: { select: { id: true, displayName: true } } },
    });
    if (row) return this.ownedDto(row, viewerId, economy);
    const ownedCount = await this.prisma.plot.count({ where: { ownerId: viewerId } });
    return this.freeDto(cell, ownedCount, economy);
  }

  async mine(userId: string): Promise<PlotDto[]> {
    const economy = await this.economy.get();
    const rows = await this.prisma.plot.findMany({
      where: { ownerId: userId },
      include: { owner: { select: { id: true, displayName: true } } },
      orderBy: { acquiredAt: 'desc' },
    });
    return rows.map((p) => this.ownedDto(p, userId, economy));
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

  /**
   * Buys (or, for the starter plot, claims) a free cell in one transaction:
   * roll the rarity with the odds shown to the player, insert the plot (fails
   * if taken), take payment (fails if too poor), write the ledger. Any failure
   * rolls everything back.
   */
  private async acquire(userId: string, cell: Cell, starter: boolean): Promise<BuyPlotResponse> {
    const economy = await this.economy.get();
    const rarity = rollRarity(rarityOdds(cell, economy));
    try {
      return await this.prisma.$transaction(async (tx) => {
        let wallet = await this.wallet.ensure(tx, userId);
        const ownedCount = await tx.plot.count({ where: { ownerId: userId } });
        const price = starter ? 0 : plotPrice(ownedCount, economy);
        const plot = await tx.plot.create({
          data: { row: cell.row, col: cell.col, ownerId: userId, rarity },
          include: { owner: { select: { id: true, displayName: true } } },
        });
        if (starter) {
          const { count } = await tx.user.updateMany({ where: { id: userId, starterClaimed: false }, data: { starterClaimed: true } });
          if (count !== 1) throw new ConflictException({ code: 'starter_already_claimed' });
        } else {
          wallet = await this.wallet.change(tx, userId, 'coins', -price, 'plot_purchase', cellKey(cell));
        }
        return { plot: this.ownedDto(plot, userId, economy), wallet };
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({ code: 'plot_taken' });
      }
      throw e;
    }
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
      include: { owner: { select: { id: true, displayName: true } } },
      take: 2000,
    });
    return rows.filter((p) => {
      const c = cellCenter(p);
      return c.lat >= b.south && c.lat <= b.north && c.lng >= b.west && c.lng <= b.east;
    });
  }

  private ownedDto(p: OwnedRow, viewerId: string, economy: Economy): PlotDto {
    const { lat, lng } = cellCenter(p);
    const rarity = p.rarity as Rarity;
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
      mine: p.ownerId === viewerId,
      buildingLevel: p.buildingLevel,
      incomePerDay: plotIncome(rarity, p.buildingLevel, economy),
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
