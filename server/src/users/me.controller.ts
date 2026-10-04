import { Controller, Delete, Get, HttpCode, Patch, UseGuards } from '@nestjs/common';
import { LANGUAGES, type UserDto } from '@landrush/shared';
import { z } from 'zod';

import { AuthGuard, UserId } from '../auth/auth.guard.js';
import { ZodBody } from '../common/zod-body.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toUserDto, UsersService } from './users.service.js';

const PatchMe = z
  .object({
    displayName: z
      .string()
      .trim()
      .regex(/^[\p{L}\p{N}_]{3,20}$/u, '3–20 letters, numbers or _'),
    language: z.enum(LANGUAGES),
  })
  .partial();

@UseGuards(AuthGuard)
@Controller('me')
export class MeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  @Get()
  async me(@UserId() userId: string): Promise<UserDto> {
    return toUserDto(await this.prisma.user.findUniqueOrThrow({ where: { id: userId } }));
  }

  @Patch()
  async update(@UserId() userId: string, @ZodBody(PatchMe) body: z.infer<typeof PatchMe>): Promise<UserDto> {
    return toUserDto(await this.users.update(userId, body));
  }

  /** Permanently deletes the account and all its sessions (App Store requirement). */
  @Delete()
  @HttpCode(204)
  async remove(@UserId() userId: string): Promise<void> {
    await this.prisma.user.delete({ where: { id: userId } });
  }
}
