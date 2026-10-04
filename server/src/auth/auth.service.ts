import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthResponse } from '@landrush/shared';

import type { User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toUserDto, UsersService } from '../users/users.service.js';
import { AppleVerifier } from './apple.verifier.js';
import { hashPassword, verifyPassword } from './password.js';
import { TokensService } from './tokens.service.js';

const normalizeEmail = (e: string) => e.trim().toLowerCase();

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly tokens: TokensService,
    private readonly appleVerifier: AppleVerifier,
  ) {}

  async guest(): Promise<AuthResponse> {
    return this.issue(await this.users.create({ isGuest: true }));
  }

  /**
   * Sign in with Apple. Existing Apple account → sign in. Otherwise, if a
   * guest is signed in on this device, the guest is upgraded (keeps progress);
   * if not, a new account is created.
   */
  async apple(identityToken: string, currentUserId?: string): Promise<AuthResponse> {
    const { sub } = await this.appleVerifier.verify(identityToken);
    const existing = await this.prisma.user.findUnique({ where: { appleSub: sub } });
    if (existing) return this.issue(existing);
    const guest = await this.currentGuest(currentUserId);
    const user = guest ? await this.users.attach(guest.id, { appleSub: sub }) : await this.users.create({ appleSub: sub });
    return this.issue(user);
  }

  async register(email: string, password: string, currentUserId?: string): Promise<AuthResponse> {
    const normalized = normalizeEmail(email);
    if (await this.prisma.user.findUnique({ where: { email: normalized } })) {
      throw new ConflictException({ code: 'email_taken' });
    }
    const passwordHash = await hashPassword(password);
    const guest = await this.currentGuest(currentUserId);
    const user = guest
      ? await this.users.attach(guest.id, { email: normalized, passwordHash })
      : await this.users.create({ email: normalized, passwordHash });
    return this.issue(user);
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
    const ok = user?.passwordHash ? await verifyPassword(password, user.passwordHash) : false;
    if (!user || !ok) throw new UnauthorizedException({ code: 'invalid_credentials' });
    return this.issue(user);
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const rotated = await this.tokens.rotate(refreshToken);
    const user = await this.prisma.user.update({ where: { id: rotated.userId }, data: { lastSeenAt: new Date() } });
    return { user: toUserDto(user), accessToken: await this.tokens.accessToken(user.id), refreshToken: rotated.refreshToken };
  }

  logout(refreshToken: string) {
    return this.tokens.revoke(refreshToken);
  }

  private async currentGuest(userId?: string): Promise<User | null> {
    if (!userId) return null;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user?.isGuest ? user : null;
  }

  private async issue(user: User): Promise<AuthResponse> {
    return {
      user: toUserDto(user),
      accessToken: await this.tokens.accessToken(user.id),
      refreshToken: await this.tokens.createSession(user.id),
    };
  }
}
