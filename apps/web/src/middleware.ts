import { NextResponse, type NextRequest } from 'next/server';

/**
 * Auth middleware — gates `/projects/*` (and child routes) behind the
 * `wathba_session` httpOnly cookie set by `/sign-in` / `/sign-up`.
 *
 * Public routes:
 *   /                — redirects (via app/page.tsx) to /projects → bounces here
 *   /sign-in, /sign-up
 *   /_next/*, /api/*, /favicon.ico, /robots.txt, /sitemap.xml
 */
export function middleware(req: NextRequest): NextResponse {
  const session = req.cookies.get('wathba_session')?.value;
  const { pathname } = req.nextUrl;
  const requiresAuth = pathname.startsWith('/projects');

  if (requiresAuth && !session) {
    const url = req.nextUrl.clone();
    url.pathname = '/sign-in';
    /* Preserve the original destination so we can bounce-back post-login;
     * the sign-in action ignores this today but it's there for the next pass. */
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/|api/|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)'],
};
