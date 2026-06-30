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

export function middleware(req: NextRequest): NextResponse {
  const session = req.cookies.get('wathba_session')?.value;
  const { pathname, search } = req.nextUrl;

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
