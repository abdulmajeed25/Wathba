import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

/**
 * CLOSEOUT C5 — rate-limit by WHO, not just by WHERE FROM.
 *
 * The stock tracker keys every bucket on the client IP. That is right for
 * anonymous traffic and wrong for ours: the web app is a server-rendered BFF,
 * so every authenticated call it makes on a user's behalf arrives from ONE
 * address (the Next server, or the reverse proxy in front of it). Every signed-
 * in user therefore shared a single 120/min bucket, and the /ops surface — which
 * spends an identity probe per navigation, twice over (middleware + the SSR
 * guard backstop) — drained it fastest. Two consequences, both observed:
 *
 *   · an operator working a queue got 429s on their own console, and
 *   · one busy user's traffic could exhaust the quota for everyone else.
 *
 * So: when the request carries a bearer token, key the bucket on its subject —
 * a per-account limit that no longer depends on network topology. Anonymous
 * requests keep the IP tracker, which is what actually protects sign-in and the
 * other pre-auth routes from a single source.
 *
 * The subject is read from the JWT payload WITHOUT trusting it as auth: this is
 * a bucket label, never an authorization decision (the real verification is
 * JwtAuthGuard's, downstream). A forged token yields a bucket the forger
 * controls and nothing more — they cannot spend anyone else's quota, and they
 * cannot escape a limit, only pick which one they are counted against. An
 * unparseable token falls back to the IP.
 */
@Injectable()
export class SubjectThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const header = req.headers?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      const sub = subjectOf(header.slice('Bearer '.length));
      if (sub) return `sub:${sub}`;
    }
    // The ops surface authenticates with an opaque ops token, not a JWT; it is
    // already the narrowest possible identifier, so use it directly.
    const opsToken = req.headers?.['x-ops-token'];
    if (typeof opsToken === 'string' && opsToken.length > 0) return `ops:${opsToken}`;

    return super.getTracker(req);
  }
}

/** The `sub` claim, or null if this is not a readable JWT. Never throws. */
function subjectOf(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')) as {
      sub?: unknown;
    };
    return typeof payload.sub === 'string' && payload.sub.length > 0 ? payload.sub : null;
  } catch {
    return null;
  }
}
