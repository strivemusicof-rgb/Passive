import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { env } from './config.js';

async function bootstrap() {
  const config = env();
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.listen(config.PORT);
}
await bootstrap();
