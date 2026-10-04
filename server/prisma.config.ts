import { defineConfig } from 'prisma/config';

// Prisma 7 no longer reads .env by itself. Missing .env is fine (CI, Docker).
try {
  process.loadEnvFile();
} catch {}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Not required for `prisma generate`, so CI installs work without a database.
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
