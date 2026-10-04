import { Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import type { RewardsDto } from '@landrush/shared';
import type { z } from 'zod';

import { AuthGuard, UserId } from '../auth/auth.guard.js';
import { ZodBody } from '../common/zod-body.js';
import { CashoutBody, RewardsService } from './rewards.service.js';

@UseGuards(AuthGuard)
@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @Get()
  summary(@UserId() userId: string): Promise<RewardsDto> {
    return this.rewards.summary(userId);
  }

  @Post('cashout')
  @HttpCode(200)
  cashout(@UserId() userId: string, @ZodBody(CashoutBody) body: z.infer<typeof CashoutBody>): Promise<RewardsDto> {
    return this.rewards.requestCashout(userId, body);
  }
}
