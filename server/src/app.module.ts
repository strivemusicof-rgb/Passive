import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AuthModule } from './auth/auth.module.js';
import { env } from './config.js';
import { HealthModule } from './health/health.module.js';
import { PlotsModule } from './plots/plots.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    // Default limit for every route; auth routes set stricter ones.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
      skipIf: () => env().NODE_ENV === 'test',
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    PlotsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
