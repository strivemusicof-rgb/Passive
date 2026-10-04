import { BadRequestException, Controller, HttpCode, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import type {
  BuyPlotResponse,
  CollectResponse,
  IncomeDto,
  MapPlotsResponse,
  PlotDto,
  UpgradeResponse,
  WalletDto,
} from '@landrush/shared';
import { parseCellKey, type Cell } from '@landrush/shared/grid';
import { z } from 'zod';

import { AuthGuard, UserId } from '../auth/auth.guard.js';
import { ZodBody } from '../common/zod-body.js';
import { IncomeService } from '../income/income.service.js';
import { WalletService } from '../wallet/wallet.service.js';
import { PlotsService } from './plots.service.js';

const lat = z.coerce.number().min(-85).max(85);
const lng = z.coerce.number().min(-180).max(180);
const BoxQuery = z.object({ south: lat, west: lng, north: lat, east: lng });
/** Biggest map area one request may ask for (~10 km). */
const MAX_SPAN_DEG = 0.1;
const StarterBody = z.object({ lat, lng });

function cellParam(key: string): Cell {
  const cell = parseCellKey(key);
  if (!cell) throw new BadRequestException({ code: 'invalid_plot' });
  return cell;
}

@UseGuards(AuthGuard)
@Controller()
export class PlotsController {
  constructor(
    private readonly plots: PlotsService,
    private readonly wallet: WalletService,
    private readonly income: IncomeService,
  ) {}

  @Get('me/income')
  getIncome(@UserId() userId: string): Promise<IncomeDto> {
    return this.income.summary(userId);
  }

  @Post('collect')
  @HttpCode(200)
  collect(@UserId() userId: string): Promise<CollectResponse> {
    return this.income.collectNow(userId);
  }

  @Post('me/storage/upgrade')
  @HttpCode(200)
  upgradeStorage(@UserId() userId: string): Promise<Pick<CollectResponse, 'wallet' | 'income'>> {
    return this.income.upgradeStorage(userId);
  }

  @Get('wallet')
  getWallet(@UserId() userId: string): Promise<WalletDto> {
    return this.wallet.get(userId);
  }

  @Get('map/plots')
  map(@UserId() userId: string, @Query() query: unknown): Promise<MapPlotsResponse> {
    const parsed = BoxQuery.safeParse(query);
    if (!parsed.success) throw new BadRequestException({ code: 'validation_failed' });
    const b = parsed.data;
    if (b.north <= b.south || b.east <= b.west) throw new BadRequestException({ code: 'validation_failed' });
    if (b.north - b.south > MAX_SPAN_DEG || b.east - b.west > MAX_SPAN_DEG * 2) {
      throw new BadRequestException({ code: 'area_too_large' });
    }
    return this.plots.map(b, userId);
  }

  @Get('me/plots')
  mine(@UserId() userId: string): Promise<PlotDto[]> {
    return this.plots.mine(userId);
  }

  @Get('plots/:key')
  one(@UserId() userId: string, @Param('key') key: string): Promise<PlotDto> {
    return this.plots.one(cellParam(key), userId);
  }

  @Post('plots/starter')
  starter(@UserId() userId: string, @ZodBody(StarterBody) body: z.infer<typeof StarterBody>): Promise<BuyPlotResponse> {
    return this.plots.claimStarter(userId, body.lat, body.lng);
  }

  @Post('plots/:key/upgrade')
  @HttpCode(200)
  upgrade(@UserId() userId: string, @Param('key') key: string): Promise<UpgradeResponse> {
    return this.plots.upgrade(userId, cellParam(key));
  }

  @Post('plots/:key/buy')
  buy(@UserId() userId: string, @Param('key') key: string): Promise<BuyPlotResponse> {
    return this.plots.buy(userId, cellParam(key));
  }
}
