import { redirect } from 'next/navigation';

import { getMe, type ApiUserMe } from '@/lib/api/wathba';

/**
 * STAKES/S-1 — server-side access guards for role-gated pages.
 *
 * Middleware already bounces anonymous callers to /sign-in?next=… (cookie
 * presence check). These run INSIDE the page (after that gate) and enforce the
 * real authorization: a valid session AND the right role/ownership. Without
 * them a plain BACKER renders the creator dashboard, admin, and supplier pages
 * (the bug that triggered the STAKES audit).
 *
 * On failure they `redirect()` (throws NEXT_REDIRECT — never returns), so call
 * sites can treat the return as a guaranteed authorized user.
 */

/** Current signed-in user, or null (expired/invalid token). */
export async function getSessionUser(): Promise<ApiUserMe | null> {
  return getMe();
}

/** Require a valid session (re-auth if the cookie's token is dead). */
export async function requireUser(): Promise<ApiUserMe> {
  const user = await getMe();
  if (!user) redirect('/sign-in');
  return user;
}

/** Require a specific role; wrong role → home (not an error page). */
export async function requireRole(role: string): Promise<ApiUserMe> {
  const user = await requireUser();
  if (!user.roles.includes(role)) redirect('/projects');
  return user;
}

/**
 * STAKES/B2+B3 — creator-dashboard access. "Creator" = holds the CREATOR role
 * OR has created ≥1 project. A backer with zero projects is sent to the
 * explicit "start a project" flow instead of the empty creator shell.
 */
export async function requireCreator(): Promise<ApiUserMe> {
  const user = await requireUser();
  const isCreator = user.roles.includes('CREATOR') || (user.createdProjectsCount ?? 0) > 0;
  if (!isCreator) redirect('/projects/start');
  return user;
}

/**
 * STAKES/B1 — post-login (or "go to my area") destination by role & state.
 * Explicit deep links win; otherwise ADMIN → admin, creator → dashboard,
 * everyone else → the discover home.
 */
export function destinationFor(user: Pick<ApiUserMe, 'roles' | 'createdProjectsCount'>): string {
  if (user.roles.includes('ADMIN')) return '/projects/admin';
  if (user.roles.includes('CREATOR') || (user.createdProjectsCount ?? 0) > 0) {
    return '/projects/dashboard';
  }
  return '/projects';
}
