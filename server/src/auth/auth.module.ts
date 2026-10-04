import { Global, Module } from '@nestjs/common';

import { MeController } from '../users/me.controller.js';
import { UsersService } from '../users/users.service.js';
import { AppleVerifier } from './apple.verifier.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { TokensService } from './tokens.service.js';

@Global()
@Module({
  controllers: [AuthController, MeController],
  providers: [AuthService, TokensService, AppleVerifier, AuthGuard, UsersService],
  exports: [TokensService, AuthGuard, UsersService],
})
export class AuthModule {}
