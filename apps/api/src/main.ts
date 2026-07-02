import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConsoleLogger, ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    // Structured JSON logs in prod (Sprint 4 / P1-801) — one parseable line
    // per event for the log pipeline; pretty console in dev.
    logger: new ConsoleLogger({ json: process.env.NODE_ENV === 'production' }),
  });

  // Request log with correlation id — pairs with AllExceptionsFilter.
  const http = new Logger('HTTP');
  app.use((req: import('express').Request, res: import('express').Response, next: () => void) => {
    const started = Date.now();
    res.on('finish', () => {
      const cid = res.getHeader('x-correlation-id') ?? req.headers['x-correlation-id'] ?? '-';
      const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms cid=${String(cid)}`;
      if (res.statusCode >= 500) http.error(line);
      else if (res.statusCode >= 400) http.warn(line);
      else http.log(line);
    });
    next();
  });

  app.use(helmet({ contentSecurityPolicy: false }));
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(','),
    credentials: true,
  });
  app.setGlobalPrefix('v1');
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    const swagger = new DocumentBuilder()
      .setTitle('Wathba API')
      .setDescription('Reward-based crowdfunding with execution-guarantee escrow.')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const doc = SwaggerModule.createDocument(app, swagger);
    SwaggerModule.setup('docs', app, doc);
  }

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`Wathba API listening on :${port}`, 'Bootstrap');
}

bootstrap().catch((err) => {
   
  console.error('Failed to start API', err);
  process.exit(1);
});
