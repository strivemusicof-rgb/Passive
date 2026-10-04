import { BadRequestException, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import type { ListingDto, MarketBuyResponse, MarketResponse, MyMarketResponse } from '@landrush/shared';
import { parseCellKey, type Cell } from '@landrush/shared/grid';
import type { z } from 'zod';

import { AuthGuard, UserId } from '../auth/auth.guard.js';
import { ZodBody } from '../common/zod-body.js';
import { ListBody, MarketQuery, MarketService } from './market.service.js';

function cellParam(key: string): Cell {
  const cell = parseCellKey(key);
  if (!cell) throw new BadRequestException({ code: 'invalid_plot' });
  return cell;
}

@UseGuards(AuthGuard)
@Controller()
export class MarketController {
  constructor(private readonly market: MarketService) {}

  @Get('market')
  browse(@UserId() userId: string, @Query() query: unknown): Promise<MarketResponse> {
    const parsed = MarketQuery.safeParse(query);
    if (!parsed.success) throw new BadRequestException({ code: 'validation_failed' });
    return this.market.browse(userId, parsed.data);
  }

  @Get('market/mine')
  mine(@UserId() userId: string): Promise<MyMarketResponse> {
    return this.market.mine(userId);
  }

  @Post('plots/:key/list')
  @HttpCode(200)
  list(@UserId() userId: string, @Param('key') key: string, @ZodBody(ListBody) body: z.infer<typeof ListBody>): Promise<ListingDto> {
    return this.market.list(userId, cellParam(key), body.price);
  }

  @Post('market/:id/cancel')
  @HttpCode(200)
  cancel(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<ListingDto> {
    return this.market.cancel(userId, id);
  }

  @Post('market/:id/buy')
  @HttpCode(200)
  buy(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<MarketBuyResponse> {
    return this.market.buy(userId, id);
  }

  @Put('plots/:key/favourite')
  favourite(@UserId() userId: string, @Param('key') key: string) {
    return this.market.setFavourite(userId, cellParam(key), true);
  }

  @Delete('plots/:key/favourite')
  unfavourite(@UserId() userId: string, @Param('key') key: string) {
    return this.market.setFavourite(userId, cellParam(key), false);
  }
}
