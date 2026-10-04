import { z } from 'zod';

const DEV_JWT_SECRET = 'dev-only-secret-change-me-dev-only-secret';

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().url(),
    /** Oldest app version allowed to talk to this server (forces updates). */
    MIN_APP_VERSION: z.string().default('1.0.0'),
    /** Signs access tokens. Must be a long random string in production. */
    JWT_SECRET: z.string().min(32).default(DEV_JWT_SECRET),
    ACCESS_TOKEN_MINUTES: z.coerce.number().int().positive().default(15),
    REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(60),
    /** Sign in with Apple tokens must be issued for this app. */
    APPLE_BUNDLE_ID: z.string().default('lv.landrush.app'),
  })
  .refine((e) => e.NODE_ENV !== 'production' || e.JWT_SECRET !== DEV_JWT_SECRET, {
    message: 'JWT_SECRET must be set in production',
    path: ['JWT_SECRET'],
  });

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/** Validated environment. Fails fast at startup if something is missing. */
export function env(): Env {
  if (!cached) {
    try {
      process.loadEnvFile();
    } catch {}
    cached = EnvSchema.parse(process.env);
  }
  return cached;
}
