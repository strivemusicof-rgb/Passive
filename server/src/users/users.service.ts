import { ConflictException, Injectable } from '@nestjs/common';
import type { Language, UserDto } from '@landrush/shared';
import { randomInt } from 'node:crypto';

import { userStyle } from '../cosmetics/style.js';
import { Prisma, type User } from '../generated/prisma/client.js';
import { levelProgress } from '../progress/levels.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const nameKey = (name: string) => name.trim().toLowerCase();

export function toUserDto(u: User): UserDto {
  const { current, needed } = levelProgress(u.xp);
  return {
    id: u.id,
    displayName: u.displayName,
    style: userStyle(u),
    isGuest: u.isGuest,
    hasApple: !!u.appleSub,
    hasEmail: !!u.email,
    language: u.language as Language,
    level: u.level,
    xp: u.xp,
    levelXp: { current, needed },
    createdAt: u.createdAt.toISOString(),
  };
}

function isUniqueViolation(e: unknown, field?: string) {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') return false;
  if (!field) return true;
  // Prisma 7 + driver adapters report the columns in different places; check them all.
  return JSON.stringify(e.meta ?? {}).includes(field) || e.message.includes(field);
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates a user with a free "Player123456" style name. */
  async create(data: Omit<Prisma.UserCreateInput, 'displayName' | 'displayNameKey'>): Promise<User> {
    for (let attempt = 0; ; attempt++) {
      const displayName = `Player${randomInt(100000, 1000000)}`;
      try {
        return await this.prisma.user.create({ data: { ...data, displayName, displayNameKey: nameKey(displayName) } });
      } catch (e) {
        if (isUniqueViolation(e, 'display_name_key') && attempt < 5) continue;
        if (isUniqueViolation(e, 'email')) throw new ConflictException({ code: 'email_taken' });
        throw e;
      }
    }
  }

  async update(id: string, data: { displayName?: string; language?: Language }): Promise<User> {
    try {
      return await this.prisma.user.update({
        where: { id },
        data: {
          ...(data.displayName ? { displayName: data.displayName.trim(), displayNameKey: nameKey(data.displayName) } : {}),
          ...(data.language ? { language: data.language } : {}),
        },
      });
    } catch (e) {
      if (isUniqueViolation(e, 'display_name_key')) throw new ConflictException({ code: 'name_taken' });
      if (isUniqueViolation(e, 'email')) throw new ConflictException({ code: 'email_taken' });
      throw e;
    }
  }

  /** Upgrades a guest by attaching a login method. */
  async attach(id: string, data: { appleSub?: string; email?: string; passwordHash?: string }): Promise<User> {
    try {
      return await this.prisma.user.update({ where: { id }, data: { ...data, isGuest: false } });
    } catch (e) {
      if (isUniqueViolation(e, 'email')) throw new ConflictException({ code: 'email_taken' });
      throw e;
    }
  }
}
