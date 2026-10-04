import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module.js';
import { env } from './config.js';

async function bootstrap() {
  const config = env();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Behind Nginx/Caddy (and Docker's network) every request arrives from a
  // local/private address. Trust X-Forwarded-For from those so rate limits
  // see each player's real IP instead of lumping everyone together.
  app.set('trust proxy', 'loopback, uniquelocal');
  app.enableShutdownHooks();
  // Auth uses bearer tokens (no cookies), so allowing any origin is safe; it
  // lets the web preview of the app call the API.
  app.enableCors();
  await app.listen(config.PORT);
}
await bootstrap();
