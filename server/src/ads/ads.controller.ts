import { BadRequestException, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { AdPlacement, AdRewardResponse, AdsDto } from '@landrush/shared';
import type { Request } from 'express';
import type { z } from 'zod';

import { AuthGuard, UserId } from '../auth/auth.guard.js';
import { ZodBody } from '../common/zod-body.js';
import { AdStartBody, AdsService } from './ads.service.js';

@Controller('ads')
export class AdsController {
  constructor(private readonly ads: AdsService) {}

  @UseGuards(AuthGuard)
  @Get()
  status(@UserId() userId: string): Promise<AdsDto> {
    return this.ads.status(userId);
  }

  @UseGuards(AuthGuard)
  @Post('start')
  @HttpCode(200)
  start(@UserId() userId: string, @ZodBody(AdStartBody) body: z.infer<typeof AdStartBody>): Promise<{ id: string }> {
    return this.ads.start(userId, body.placement as AdPlacement);
  }

  @UseGuards(AuthGuard)
  @Post(':id/complete')
  @HttpCode(200)
  complete(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<AdRewardResponse> {
    return this.ads.complete(userId, id);
  }

  /** AdMob server-side verification callback (no login: Google signs it). */
  @Get('ssv')
  async ssv(@Req() req: Request): Promise<{ ok: true }> {
    const q = req.originalUrl.indexOf('?');
    if (q < 0 || !(await this.ads.ssv(req.originalUrl.slice(q + 1)))) throw new BadRequestException({ code: 'invalid_signature' });
    return { ok: true };
  }
}
