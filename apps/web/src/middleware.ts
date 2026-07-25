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

// OPS-GAPS Y2 — DB-backed maintenance flag, polled from the public status
// probe at most every 30s (per-instance module cache) so an operator can flip
// maintenance without a redeploy. The env var stays a hard override.
let maintCache = { on: false, at: 0 };
async function dbMaintenanceOn(): Promise<boolean> {
  const now = Date.now();
  if (now - maintCache.at < 30_000) return maintCache.on;
  try {
    const r = await fetch(`${API_BASE}/v1/platform/status`, { cache: 'no-store' });
    const on = r.ok ? Boolean(((await r.json()) as { maintenance?: boolean }).maintenance) : false;
    maintCache = { on, at: now };
    return on;
  } catch {
    // Probe unreachable → don't lock everyone out on a transient blip; keep the
    // last known value (defaults false), env override still applies below.
    maintCache = { ...maintCache, at: now };
    return maintCache.on;
  }
}

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

  // STAKES/S-13 (G5) + OPS-GAPS Y2 — maintenance mode: the MAINTENANCE_MODE=1
  // env var (hard, infra-level) OR the operator-tunable DB flag (settings →
  // platform.maintenanceMode, polled via the cached status probe) rewrites
  // every page to the 503 surface (/maintenance itself stays reachable). The
  // /ops surface is exempt so operators can turn maintenance back off.
  const maintenanceOn =
    process.env.MAINTENANCE_MODE === '1' || (!pathname.startsWith('/ops') && (await dbMaintenanceOn()));
  if (maintenanceOn && pathname !== '/maintenance' && !pathname.startsWith('/ops')) {
    const url = req.nextUrl.clone();
    url.pathname = '/maintenance';
    url.search = '';
    return NextResponse.rewrite(url, { status: 503 });
  }
  if (!maintenanceOn && pathname === '/maintenance') {
    // Not in maintenance → don't leave a stale bookmark surface up; go home.
    return NextResponse.redirect(new URL('/projects', req.url));
  }

  // OPS Part 1 — /ops is its own hardened surface. Middleware enforces, in
  // order: (1) a public session exists, (2) the account holds ADMIN (checked
  // against the API — the /ops layout re-checks server-side as the backstop),
  // (3) beyond /ops/enter, the SEPARATE ops-session cookie exists. Every
  // /ops response also carries X-Robots-Tag (robots.ts already disallows).
  if (pathname === '/ops' || pathname.startsWith('/ops/')) {
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = '/sign-in';
      url.searchParams.set('next', pathname + (search || ''));
      return NextResponse.redirect(url);
    }
    // CLOSEOUT C5 — an RSC prefetch does not need the role probe. The gate that
    // actually protects this surface is the layout's own requireAdmin() (see
    // app/ops/layout.tsx): it runs on every render, prefetched or not, and
    // redirects a non-ADMIN before any operator content is produced. Spending a
    // second network round-trip here per prefetch bought no security and cost
    // enough quota to lock operators out of their own console. A prefetch with
    // no session was already turned away above.
    if (req.headers.get('next-router-prefetch') === '1') {
      const res = NextResponse.next();
      res.headers.set('X-Robots-Tag', 'noindex, nofollow');
      return res;
    }
    try {
      const meRes = await fetch(`${API_BASE}/v1/users/me`, {
        headers: { Authorization: `Bearer ${session}` },
        cache: 'no-store',
      });
      // CLOSEOUT C5 — ONLY a verdict from the API may destroy a session.
      // 401/403 means "this credential is not good" → sign out. Anything else
      // (429 from the shared SSR rate-limit bucket, a 5xx, a blip) is the API
      // failing to ANSWER, not a rejection of the token: deleting the cookies
      // there logged the operator out of a live session mid-navigation, and
      // because every /ops view spends an identity probe, a burst of clicking
      // was enough to trigger it. Refuse the surface, keep the credential.
      if (meRes.status === 401 || meRes.status === 403) {
        const url = req.nextUrl.clone();
        url.pathname = '/sign-in';
        url.searchParams.set('next', pathname + (search || ''));
        const res = NextResponse.redirect(url);
        res.cookies.delete('wathba_session');
        res.cookies.delete('wathba_refresh');
        return res;
      }
      if (!meRes.ok) {
        // Indeterminate — REFUSE rather than degrade on the ops surface, but
        // never confiscate the session over it (same stance as the catch below).
        const url = req.nextUrl.clone();
        url.pathname = '/projects';
        url.search = '';
        return NextResponse.redirect(url);
      }
      const me = (await meRes.json()) as { roles: string[] };
      if (!me.roles.includes('ADMIN')) {
        const url = req.nextUrl.clone();
        url.pathname = '/projects';
        url.search = '';
        return NextResponse.redirect(url);
      }
    } catch {
      // API unreachable — REFUSE rather than degrade on the ops surface.
      const url = req.nextUrl.clone();
      url.pathname = '/projects';
      url.search = '';
      return NextResponse.redirect(url);
    }
    if (!pathname.startsWith('/ops/enter') && !req.cookies.get('wathba_ops_session')?.value) {
      const url = req.nextUrl.clone();
      url.pathname = '/ops/enter';
      url.search = '';
      return NextResponse.redirect(url);
    }
    const res = NextResponse.next();
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return res;
  }

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

  // STAKES/B2+B5+B6 — role/ownership gate, enforced HERE (not only in the page)
  // because a Server-Component `redirect()` in dynamic SSR is emitted as a soft
  // client redirect that a non-browser sees as 200. Middleware issues a real
  // 307 that can't be swallowed by an error boundary or bypassed by a script.
  if (session) {
    const gate = ROLE_GATES.find((g) => pathname === g.prefix || pathname.startsWith(`${g.prefix}/`));
    if (gate) {
      try {
        const meRes = await fetch(`${API_BASE}/v1/users/me`, {
          headers: { Authorization: `Bearer ${session}` },
          cache: 'no-store',
        });
        if (!meRes.ok) {
          // Token dead/invalid → force re-auth.
          const url = req.nextUrl.clone();
          url.pathname = '/sign-in';
          url.searchParams.set('next', pathname + (search || ''));
          const res = NextResponse.redirect(url);
          res.cookies.delete('wathba_session');
          res.cookies.delete('wathba_refresh');
          return res;
        }
        const me = (await meRes.json()) as { roles: string[]; createdProjectsCount?: number };
        if (!gate.check(me)) {
          const url = req.nextUrl.clone();
          url.pathname = gate.deny;
          url.search = '';
          return NextResponse.redirect(url);
        }
      } catch {
        /* API unreachable — fall through; the page-level guard is the backstop. */
      }
    }
  }

  return NextResponse.next();
}

/**
 * STAKES/B1-family — role gates. A plain BACKER hitting the creator dashboard
 * is sent to the explicit "start a project" flow; wrong-role admin/supplier
 * access bounces home. (Per-project ownership is enforced in the [id] layout.)
 */
const ROLE_GATES: Array<{
  prefix: string;
  check: (me: { roles: string[]; createdProjectsCount?: number }) => boolean;
  deny: string;
}> = [
  { prefix: '/projects/admin', check: (me) => me.roles.includes('ADMIN'), deny: '/projects' },
  { prefix: '/projects/supplier', check: (me) => me.roles.includes('SUPPLIER'), deny: '/projects' },
  {
    prefix: '/projects/dashboard',
    check: (me) => me.roles.includes('CREATOR') || (me.createdProjectsCount ?? 0) > 0,
    deny: '/projects/start',
  },
];

export const config = {
  matcher: ['/((?!_next/|api/|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)'],
};
