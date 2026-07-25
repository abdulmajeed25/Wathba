import type { Request } from 'express';

import { SubjectThrottlerGuard } from './subject-throttler.guard';

/**
 * CLOSEOUT C5 — the rate-limit bucket key.
 *
 * The property under test is ISOLATION: two accounts arriving from the SAME
 * address (which is what a server-rendered BFF always looks like) must not share
 * a bucket. When they did, one user's burst spent everyone's quota — and on the
 * /ops surface, which pays an identity probe per navigation, that 429 was being
 * read as a failed auth and signed the operator out mid-session.
 *
 * getTracker is protected and needs none of the guard's DI (the nestjs base
 * returns `req.ip` and nothing else), so it is exercised directly.
 */
class Exposed extends SubjectThrottlerGuard {
  key(req: Request): Promise<string> {
    return this.getTracker(req);
  }
}

/** A JWT-shaped token: header.payload.signature, payload = base64url JSON. */
function jwtFor(claims: Record<string, unknown>): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.sIgNaTuRe`;
}

function reqOf(headers: Record<string, string>, ip = '10.0.0.7'): Request {
  return { headers, ip } as unknown as Request;
}

describe('SubjectThrottlerGuard — the rate-limit bucket key', () => {
  const guard = new Exposed(undefined as never, undefined as never, undefined as never);

  it('keys on the JWT subject, so one shared address is not one shared bucket', async () => {
    const a = await guard.key(reqOf({ authorization: `Bearer ${jwtFor({ sub: 'user-a' })}` }));
    const b = await guard.key(reqOf({ authorization: `Bearer ${jwtFor({ sub: 'user-b' })}` }));

    expect(a).toBe('sub:user-a');
    expect(b).toBe('sub:user-b');
    expect(a).not.toBe(b); // same IP, different accounts → different buckets
  });

  it('follows the account across addresses, not the network', async () => {
    const token = `Bearer ${jwtFor({ sub: 'user-a' })}`;
    expect(await guard.key(reqOf({ authorization: token }, '10.0.0.7'))).toBe(
      await guard.key(reqOf({ authorization: token }, '198.51.100.2')),
    );
  });

  it('keys the ops surface on its opaque ops token', async () => {
    expect(await guard.key(reqOf({ 'x-ops-token': 'abc123' }))).toBe('ops:abc123');
  });

  it('falls back to the IP for anonymous traffic — pre-auth routes stay IP-limited', async () => {
    expect(await guard.key(reqOf({}, '203.0.113.4'))).toBe('203.0.113.4');
  });

  it('falls back to the IP for a bearer that is not a readable JWT', async () => {
    for (const token of ['not-a-jwt', 'a.b', 'a.!!!not-base64!!!.c']) {
      expect(await guard.key(reqOf({ authorization: `Bearer ${token}` }, '203.0.113.5'))).toBe(
        '203.0.113.5',
      );
    }
  });

  it('refuses a subject bucket to a token carrying no sub claim', async () => {
    const key = await guard.key(
      reqOf({ authorization: `Bearer ${jwtFor({ roles: ['USER'] })}` }, '203.0.113.6'),
    );
    expect(key).toBe('203.0.113.6');
  });

  it('ignores a non-bearer authorization scheme', async () => {
    const key = await guard.key(reqOf({ authorization: 'Basic dXNlcjpwYXNz' }, '203.0.113.7'));
    expect(key).toBe('203.0.113.7');
  });
});
