import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  /** Oldest app version allowed to talk to this server (forces updates). */
  MIN_APP_VERSION: z.string().default('1.0.0'),
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
