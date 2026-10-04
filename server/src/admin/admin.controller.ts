import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  Injectable,
  Param,
  Post,
  Query,
  UseGuards,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';

import { env } from '../config.js';
import { RewardsService } from '../rewards/rewards.service.js';
import { ADMIN_PAGE } from './admin-page.js';

const digest = (s: string) => createHash('sha256').update(s).digest();

/** Admin API needs the ADMIN_TOKEN in the x-admin-token header (compared in constant time). */
@Injectable()
class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const expected = env().ADMIN_TOKEN;
    const given = ctx.switchToHttp().getRequest<Request>().headers['x-admin-token'];
    if (!expected || typeof given !== 'string' || !timingSafeEqual(digest(given), digest(expected))) {
      throw new ForbiddenException();
    }
    return true;
  }
}

@Controller('admin')
export class AdminController {
  constructor(private readonly rewards: RewardsService) {}

  /** The admin web page itself (it asks for the token and calls the API below). */
  @Get()
  @SkipThrottle()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  @Header('X-Frame-Options', 'DENY')
  page(): string {
    return ADMIN_PAGE;
  }

  @Get('api/cashouts')
  @UseGuards(AdminGuard)
  list(@Query('status') status?: string) {
    return this.rewards.adminList(['pending', 'approved', 'paid', 'rejected'].includes(status ?? '') ? status : undefined);
  }

  @Post('api/cashouts/:id/:action')
  @UseGuards(AdminGuard)
  @HttpCode(200)
  decide(@Param('id') id: string, @Param('action') action: string, @Body() body: { note?: string }) {
    if (action !== 'approve' && action !== 'paid' && action !== 'reject') throw new ForbiddenException();
    return this.rewards.adminDecide(id, action, typeof body?.note === 'string' ? body.note.slice(0, 300) : undefined);
  }

  @Get('api/rewards-enabled')
  @UseGuards(AdminGuard)
  async getEnabled() {
    return { enabled: (await this.rewards.adminRewardsConfig()).enabled };
  }

  @Post('api/rewards-enabled')
  @UseGuards(AdminGuard)
  @HttpCode(200)
  setEnabled(@Body() body: { enabled?: boolean }) {
    return this.rewards.adminSetEnabled(body?.enabled === true);
  }
}
