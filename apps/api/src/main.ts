import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { isProduction, readCsvEnv } from './common/env';
import { AppModule } from './app.module';

function getCorsOrigins() {
  const configured = readCsvEnv('CORS_ORIGINS');
  if (configured.length > 0) return configured;

  if (isProduction()) {
    return false;
  }

  return ['http://localhost:3010', 'http://127.0.0.1:3010'];
}

function getPort() {
  const rawPort = Number(process.env.PORT || 4000);
  return Number.isFinite(rawPort) && rawPort > 0 ? rawPort : 4000;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: getCorsOrigins(),
    credentials: true,
  });

  app.enableShutdownHooks();

  await app.listen(getPort(), '0.0.0.0');
}
bootstrap();
