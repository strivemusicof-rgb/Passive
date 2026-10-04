import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { LeaderboardResponse } from '@landrush/shared';
import { z } from 'zod';

import { AuthGuard, UserId } from '../auth/auth.guard.js';
import { LeaderboardService } from './leaderboard.service.js';

const Scope = z.enum(['all', 'month', 'near']).catch('all');

@UseGuards(AuthGuard)
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Get()
  board(@UserId() userId: string, @Query('scope') scope?: string): Promise<LeaderboardResponse> {
    return this.leaderboard.board(userId, Scope.parse(scope));
  }
}
