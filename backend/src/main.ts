import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Global exception filter for sanitized error responses
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global logging interceptor with correlation ID
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Input validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // CORS configuration
  const frontendUrl = process.env.FRONTEND_URL;
  const corsOrigin = frontendUrl
    ? frontendUrl.split(',').map((origin) => origin.trim()).filter(Boolean)
    : '*';

  app.enableCors({
    origin: corsOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: '*',
    exposedHeaders: ['x-correlation-id', 'Content-Disposition'],
  });

  // Global API Prefix with exclusions for root and health check endpoints
  app.setGlobalPrefix('api/v1', {
    exclude: ['/', 'health/liveness', 'health/readiness'],
  });

  // Enable graceful shutdown hooks
  app.enableShutdownHooks();

  const port = parseInt(process.env.PORT || '4000', 10);
  const host = '0.0.0.0';

  await app.listen(port, host);
  logger.log(`Document Intelligence Backend running on http://${host}:${port}`);
  logger.log(`API Prefix: /api/v1 | Health checks: /health/liveness & /health/readiness`);
}

bootstrap();
