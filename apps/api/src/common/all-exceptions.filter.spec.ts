/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

/**
 * AllExceptionsFilter — Sprint 4 / P1-103.
 *   HttpException keeps status + payload, gains correlationId/path/ts
 *   raw Error → opaque 500 envelope, no internals leaked
 *   inbound x-correlation-id is echoed back
 */

function host(headers: Record<string, string> = {}) {
  const res: any = {
    statusCode: 0,
    body: null,
    headers: {} as Record<string, string>,
    setHeader(k: string, v: string) {
      this.headers[k] = v;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(b: unknown) {
      this.body = b;
      return this;
    },
  };
  const req = { headers, method: 'POST', url: '/v1/pledges' };
  return {
    res,
    argumentsHost: {
      switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
    } as any,
  };
}

describe('AllExceptionsFilter', () => {
  it('passes HttpException status + payload through with envelope fields', () => {
    const { res, argumentsHost } = host();
    new AllExceptionsFilter().catch(
      new BadRequestException(['amountHalalas must be an integer']),
      argumentsHost,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toEqual(['amountHalalas must be an integer']);
    expect(res.body.correlationId).toEqual(expect.any(String));
    expect(res.body.path).toBe('/v1/pledges');
    expect(res.headers['x-correlation-id']).toBe(res.body.correlationId);
  });

  it('raw Error becomes an opaque 500 — internals never leak', () => {
    const { res, argumentsHost } = host();
    new AllExceptionsFilter().catch(
      new Error('moyasar: 502 {"secret":"leaky-internals"}'),
      argumentsHost,
    );
    expect(res.statusCode).toBe(500);
    expect(res.body.message).toBe('internal server error');
    expect(JSON.stringify(res.body)).not.toContain('leaky-internals');
    expect(res.body.correlationId).toEqual(expect.any(String));
  });

  it('echoes an inbound x-correlation-id', () => {
    const { res, argumentsHost } = host({ 'x-correlation-id': 'trace-123' });
    new AllExceptionsFilter().catch(new Error('boom'), argumentsHost);
    expect(res.body.correlationId).toBe('trace-123');
  });
});
