import { redirect } from 'next/navigation';

// Force a real server-side 307 (not a statically-optimized client redirect).
export const dynamic = 'force-dynamic';

/**
 * CC-10 — the legacy launch wizard (WathbaStart) posted to /v1/ventures, an
 * endpoint that does not exist on the Wathba API, so it dead-ended on publish.
 * The canonical, working create+submit flow is /projects/submit (server action
 * → POST /v1/projects → POST /v1/projects/:id/submit). Redirect here so there
 * is a single, functional create path.
 *
 * The component itself has since been deleted — it had no importer and this
 * redirect meant it could never render. THIS ROUTE STAYS: fourteen places link
 * to /projects/start (header CTA, home, how, handbook, profile, account menu),
 * middleware gates it, and lib/auth/guard.ts redirects non-creators here.
 */
export default function StartPage(): never {
  redirect('/projects/submit');
}
