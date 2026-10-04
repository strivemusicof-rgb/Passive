import { readFileSync } from 'node:fs';

import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import type { HealthResponse } from '@landrush/shared';

import { env } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';

// Works from both src/ (tests) and dist/ (production): both are two levels deep.
const VERSION: string = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
).version;

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('database unavailable');
    }
    return {
      status: 'ok',
      version: VERSION,
      minAppVersion: env().MIN_APP_VERSION,
      time: new Date().toISOString(),
    };
  }
}
