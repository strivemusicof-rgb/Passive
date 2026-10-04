import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet } from 'jose';

import { AppModule } from '../src/app.module.js';
import { APPLE_ISSUER, AppleVerifier } from '../src/auth/apple.verifier.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/** Fake Apple: a local RSA key pair stands in for Apple's signing keys. */
export async function fakeApple() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test', alg: 'RS256' };
  class TestAppleVerifier extends AppleVerifier {
    protected override keys = createLocalJWKSet({ keys: [jwk] });
  }
  const sign = (sub: string, audience = 'lv.landrush.app') =>
    new SignJWT({ email: `${sub}@privaterelay.appleid.com` })
      .setProtectedHeader({ alg: 'RS256', kid: 'test' })
      .setIssuer(APPLE_ISSUER)
      .setAudience(audience)
      .setSubject(sub)
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(privateKey);
  return { TestAppleVerifier: TestAppleVerifier as typeof AppleVerifier, sign };
}

export async function createTestApp(): Promise<{ app: INestApplication; signApple: (sub: string, aud?: string) => Promise<string> }> {
  const url = process.env.DATABASE_URL ?? '';
  // Tests wipe tables: refuse to run against anything but a *_test database.
  if (!/_test(\?|$)/.test(url)) throw new Error(`e2e tests need a *_test DATABASE_URL, got "${url}"`);
  const { TestAppleVerifier, sign } = await fakeApple();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AppleVerifier)
    .useClass(TestAppleVerifier)
    .compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  await app.get(PrismaService).$executeRawUnsafe('TRUNCATE users, sessions, wallets, transactions, plots CASCADE');
  return { app, signApple: sign };
}
