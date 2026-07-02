import { NextResponse, type NextRequest } from 'next/server';

/**
 * Auth middleware — **public-by-default** for browsing, auth-gated only for
 * acting (Kickstarter pattern).
 *
 * Anyone can read: home, explore, category, search, full project page,
 * how-it-works, ranks, legal, help.
 * Only these paths require `wathba_session`:
 *   /projects/start              — create a project
 *   /projects/dashboard          — creator dashboard
 *   /projects/admin              — admin console
 *   /projects/supplier           — supplier portal (submit bids)
 *   /projects/payments           — payment history / wallet
 *   /projects/settings           — account settings
 *   /projects/notifications      — inbox
 *   /projects/me/*               — backer's own pages (pledges / profile)
 *   /projects/<slug>/back        — pledge flow
 *   /sign-up/nafath              — KYC step (signed-up users only)
 */

const PROTECTED_PREFIXES = [
  '/projects/start',
  '/projects/submit',
  '/projects/dashboard',
  '/projects/admin',
  '/projects/supplier',
  '/projects/payments',
  '/projects/settings',
  '/projects/notifications',
  '/projects/me/',
  '/sign-up/nafath',
];

/** /projects/<anything>/back also requires auth. */
const BACK_RE = /^\/projects\/[^/]+\/back\b/;

function isProtected(pathname: string): boolean {
  if (PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) return true;
  return BACK_RE.test(pathname);
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Decode a JWT's exp (seconds) without verifying — verification is the
 *  API's job; middleware only needs "is it about to lapse?". */
function jwtExpMs(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      exp?: number;
    };
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

const ROTATE_AHEAD_MS = 5 * 60 * 1000; // rotate when <5 min of access left

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const session = req.cookies.get('wathba_session')?.value;
  const refresh = req.cookies.get('wathba_refresh')?.value;
  const { pathname, search } = req.nextUrl;

  // Sprint 2 / P1-502 — rotate a lapsing access token transparently.
  if (session && refresh) {
    const expMs = jwtExpMs(session);
    if (expMs !== null && expMs - Date.now() < ROTATE_AHEAD_MS) {
      try {
        const r = await fetch(`${API_BASE}/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ refreshToken: refresh }),
          cache: 'no-store',
        });
        if (r.ok) {
          const body = (await r.json()) as { accessToken: string; refreshToken: string };
          const res = NextResponse.next();
          const secure = process.env.NODE_ENV === 'production';
          res.cookies.set('wathba_session', body.accessToken, {
            httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 60 * 60 * 24 * 30,
          });
          res.cookies.set('wathba_refresh', body.refreshToken, {
            httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 60 * 60 * 24 * 30,
          });
          return res;
        }
        // Refresh rejected (revoked / replayed / expired) → force re-auth on
        // protected paths by treating the session as absent.
        if (isProtected(pathname)) {
          const url = req.nextUrl.clone();
          url.pathname = '/sign-in';
          url.searchParams.set('next', pathname + (search || ''));
          const res = NextResponse.redirect(url);
          res.cookies.delete('wathba_session');
          res.cookies.delete('wathba_refresh');
          return res;
        }
      } catch {
        /* API unreachable — fall through; SSR fetchers will degrade. */
      }
    }
  }

  if (isProtected(pathname) && !session) {
    const url = req.nextUrl.clone();
    url.pathname = '/sign-in';
    // Preserve the original destination so the sign-in action can bounce
    // the user back. Includes query-string so deep links survive auth.
    url.searchParams.set('next', pathname + (search || ''));
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/|api/|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)'],
};
