import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthResponse } from '@landrush/shared';
import type { Request } from 'express';
import { z } from 'zod';

import { ZodBody } from '../common/zod-body.js';
import { bearerToken } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { TokensService } from './tokens.service.js';

const AppleBody = z.object({ identityToken: z.string().min(20).max(5000) });
const EmailBody = z.object({ email: z.email().max(254), password: z.string().min(8).max(200) });
const RefreshBody = z.object({ refreshToken: z.string().min(20).max(200) });

// Login endpoints get a stricter rate limit than the rest of the API.
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokensService,
  ) {}

  @Post('guest')
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  guest(): Promise<AuthResponse> {
    return this.auth.guest();
  }

  @Post('apple')
  async apple(@ZodBody(AppleBody) body: z.infer<typeof AppleBody>, @Req() req: Request): Promise<AuthResponse> {
    return this.auth.apple(body.identityToken, await this.optionalUser(req));
  }

  @Post('email/register')
  async register(@ZodBody(EmailBody) body: z.infer<typeof EmailBody>, @Req() req: Request): Promise<AuthResponse> {
    return this.auth.register(body.email, body.password, await this.optionalUser(req));
  }

  @Post('email/login')
  @HttpCode(200)
  login(@ZodBody(EmailBody) body: z.infer<typeof EmailBody>): Promise<AuthResponse> {
    return this.auth.login(body.email, body.password);
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  refresh(@ZodBody(RefreshBody) body: z.infer<typeof RefreshBody>): Promise<AuthResponse> {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body() body: unknown): Promise<void> {
    const parsed = RefreshBody.safeParse(body);
    if (parsed.success) await this.auth.logout(parsed.data.refreshToken);
  }

  /** A guest upgrading their account sends their current access token. */
  private async optionalUser(req: Request): Promise<string | undefined> {
    const token = bearerToken(req);
    if (!token) return undefined;
    return this.tokens.verifyAccess(token).catch(() => undefined);
  }
}
