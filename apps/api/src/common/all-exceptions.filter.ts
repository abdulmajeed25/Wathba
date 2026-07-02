import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';

/**
 * Global exception envelope (Sprint 4 / P1-103).
 *
 * Every error leaves the API in ONE shape:
 *   { statusCode, message, error?, correlationId, path, ts }
 *
 * - HttpExceptions pass their own status/message through untouched (so
 *   class-validator arrays, 401s, 429 retryAfter etc. keep working).
 * - Anything else (raw Error, Prisma failure, PSP adapter throw) becomes an
 *   opaque 500 to the client — details go to the log, keyed by the
 *   correlationId echoed to the caller and in the `x-correlation-id` header.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const correlationId =
      (req.headers['x-correlation-id'] as string | undefined) ?? randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: Record<string, unknown>;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      body =
        typeof resp === 'string'
          ? { statusCode: status, message: resp }
          : { statusCode: status, ...(resp as Record<string, unknown>) };
      if (status >= 500) {
        this.logger.error(
          `[${correlationId}] ${req.method} ${req.url} → ${status}`,
          exception.stack,
        );
      }
    } else {
      body = {
        statusCode: status,
        message: 'internal server error',
        error: 'Internal Server Error',
      };
      this.logger.error(
        `[${correlationId}] UNHANDLED ${req.method} ${req.url}: ${String(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    body.correlationId = correlationId;
    body.path = req.url;
    body.ts = new Date().toISOString();
    res.setHeader('x-correlation-id', correlationId);
    res.status(status).json(body);
  }
}
