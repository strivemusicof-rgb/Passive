import { BadRequestException, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import type { CosmeticBuyResponse, CosmeticsResponse, PlotDto, UserDto } from '@landrush/shared';
import { parseCellKey } from '@landrush/shared/grid';
import type { z } from 'zod';

import { AuthGuard, UserId } from '../auth/auth.guard.js';
import { ZodBody } from '../common/zod-body.js';
import { CosmeticsService, PlotStyleBody, UserStyleBody } from './cosmetics.service.js';

@UseGuards(AuthGuard)
@Controller()
export class CosmeticsController {
  constructor(private readonly cosmetics: CosmeticsService) {}

  @Get('cosmetics')
  list(@UserId() userId: string): Promise<CosmeticsResponse> {
    return this.cosmetics.list(userId);
  }

  @Post('cosmetics/:id/buy')
  @HttpCode(200)
  buy(@UserId() userId: string, @Param('id') id: string): Promise<CosmeticBuyResponse> {
    return this.cosmetics.buy(userId, id);
  }

  @Post('me/style')
  @HttpCode(200)
  userStyle(@UserId() userId: string, @ZodBody(UserStyleBody) body: z.infer<typeof UserStyleBody>): Promise<UserDto> {
    return this.cosmetics.setUserStyle(userId, body);
  }

  @Post('plots/:key/style')
  @HttpCode(200)
  plotStyle(
    @UserId() userId: string,
    @Param('key') key: string,
    @ZodBody(PlotStyleBody) body: z.infer<typeof PlotStyleBody>,
  ): Promise<PlotDto> {
    const cell = parseCellKey(key);
    if (!cell) throw new BadRequestException({ code: 'invalid_plot' });
    return this.cosmetics.setPlotStyle(userId, cell, body);
  }
}
