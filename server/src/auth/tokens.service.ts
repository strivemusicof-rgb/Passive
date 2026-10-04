import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';

import { env } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class TokensService {
  private readonly secret = new TextEncoder().encode(env().JWT_SECRET);

  constructor(private readonly prisma: PrismaService) {}

  async accessToken(userId: string): Promise<string> {
    return new SignJWT({ typ: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(`${env().ACCESS_TOKEN_MINUTES}m`)
      .sign(this.secret);
  }

  /** Returns the user id, or throws 401. */
  async verifyAccess(token: string): Promise<string> {
    try {
      const { payload } = await jwtVerify(token, this.secret, { algorithms: ['HS256'] });
      if (payload.typ !== 'access' || !payload.sub) throw new Error('bad token');
      return payload.sub;
    } catch {
      throw new UnauthorizedException({ code: 'unauthorized' });
    }
  }

  /** Starts a new device session and returns its refresh token. */
  async createSession(userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.session.create({
      data: { userId, tokenHash: sha256(token), expiresAt: this.refreshExpiry() },
    });
    return token;
  }

  /**
   * Swaps a refresh token for a new one (rotation): the old token stops
   * working immediately, so a stolen token can be used at most once.
   */
  async rotate(refreshToken: string): Promise<{ userId: string; refreshToken: string }> {
    const session = await this.prisma.session.findUnique({ where: { tokenHash: sha256(refreshToken) } });
    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException({ code: 'invalid_refresh_token' });
    }
    const next = randomBytes(32).toString('base64url');
    // Conditional update: if two requests race with the same token, only one wins.
    const { count } = await this.prisma.session.updateMany({
      where: { id: session.id, tokenHash: session.tokenHash },
      data: { tokenHash: sha256(next), expiresAt: this.refreshExpiry(), lastUsedAt: new Date() },
    });
    if (count !== 1) throw new UnauthorizedException({ code: 'invalid_refresh_token' });
    return { userId: session.userId, refreshToken: next };
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { tokenHash: sha256(refreshToken) } });
  }

  private refreshExpiry() {
    return new Date(Date.now() + env().REFRESH_TOKEN_DAYS * 24 * 3600 * 1000);
  }
}
