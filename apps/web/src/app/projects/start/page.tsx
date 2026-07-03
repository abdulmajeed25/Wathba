import { redirect } from 'next/navigation';

// Force a real server-side 307 (not a statically-optimized client redirect).
export const dynamic = 'force-dynamic';

/**
 * CC-10 — the legacy launch wizard (WathbaStart) posted to /v1/ventures, an
 * endpoint that does not exist on the Wathba API, so it dead-ended on publish.
 * The canonical, working create+submit flow is /projects/submit (server action
 * → POST /v1/projects → POST /v1/projects/:id/submit). Redirect here so there
 * is a single, functional create path.
 */
export default function StartPage(): never {
  redirect('/projects/submit');
}
