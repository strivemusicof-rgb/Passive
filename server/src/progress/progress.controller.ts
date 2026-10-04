import { BadRequestException, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import type { AchievementDto, DailyRewardDto, MissionsResponse, RewardResponse } from '@landrush/shared';
import { parseCellKey } from '@landrush/shared/grid';
import { z } from 'zod';

import { AuthGuard, UserId } from '../auth/auth.guard.js';
import { ZodBody } from '../common/zod-body.js';
import { ProgressService } from './progress.service.js';

const CheckInBody = z.object({ lat: z.number().min(-85).max(85), lng: z.number().min(-180).max(180) });

@UseGuards(AuthGuard)
@Controller()
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get('missions')
  missions(@UserId() userId: string): Promise<MissionsResponse> {
    return this.progress.missions(userId);
  }

  @Post('missions/:scope/:key/claim')
  @HttpCode(200)
  claim(@UserId() userId: string, @Param('scope') scope: string, @Param('key') key: string): Promise<RewardResponse> {
    if (scope !== 'daily' && scope !== 'weekly') throw new BadRequestException({ code: 'validation_failed' });
    return this.progress.claimMission(userId, scope, key);
  }

  @Get('daily')
  daily(@UserId() userId: string): Promise<DailyRewardDto> {
    return this.progress.daily(userId);
  }

  @Post('daily/claim')
  @HttpCode(200)
  claimDaily(@UserId() userId: string): Promise<RewardResponse & { daily: DailyRewardDto }> {
    return this.progress.claimDaily(userId);
  }

  @Post('plots/:key/checkin')
  @HttpCode(200)
  checkIn(@UserId() userId: string, @Param('key') key: string, @ZodBody(CheckInBody) body: z.infer<typeof CheckInBody>): Promise<RewardResponse> {
    const cell = parseCellKey(key);
    if (!cell) throw new BadRequestException({ code: 'invalid_plot' });
    return this.progress.checkIn(userId, cell, body);
  }

  @Get('me/achievements')
  achievements(@UserId() userId: string): Promise<AchievementDto[]> {
    return this.progress.achievements(userId);
  }
}
