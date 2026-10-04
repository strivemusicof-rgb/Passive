import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

import { env } from '../config.js';

export const APPLE_ISSUER = 'https://appleid.apple.com';

export type AppleIdentity = { sub: string; email?: string };

/**
 * Checks a Sign in with Apple identity token: signed by Apple, issued for
 * our bundle id and not expired. Tests swap `keys` for a local key set.
 */
@Injectable()
export class AppleVerifier {
  protected keys: JWTVerifyGetKey = createRemoteJWKSet(new URL(`${APPLE_ISSUER}/auth/keys`));

  async verify(identityToken: string): Promise<AppleIdentity> {
    try {
      const { payload } = await jwtVerify(identityToken, this.keys, {
        issuer: APPLE_ISSUER,
        audience: env().APPLE_BUNDLE_ID,
      });
      if (!payload.sub) throw new Error('no sub');
      return { sub: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined };
    } catch {
      throw new UnauthorizedException({ code: 'invalid_apple_token' });
    }
  }
}
