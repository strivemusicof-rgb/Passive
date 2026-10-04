import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { env } from './config.js';

async function bootstrap() {
  const config = env();
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  // Auth uses bearer tokens (no cookies), so allowing any origin is safe; it
  // lets the web preview of the app call the API.
  app.enableCors();
  await app.listen(config.PORT);
}
await bootstrap();
