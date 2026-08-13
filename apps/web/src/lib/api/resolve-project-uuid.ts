const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Batch ACCOUNT / U9 — turn whatever the client holds into the project's uuid.
 *
 * A project has TWO public addresses: its uuid and its slug. Pages use the slug
 * (/projects/nakhil-dates) because that is what belongs in a URL, while every
 * mutating endpoint takes the uuid behind a ParseUUIDPipe. Any control living
 * on a campaign page therefore holds the wrong one.
 *
 * That mismatch already shipped once: the follow button posted
 * `/api/.../nakhil-dates`, the API 400'd, and the optimistic update rolled back
 * — the control flipped, flipped back, and wrote nothing. It looked like a
 * working UI until somebody counted rows.
 *
 * Resolving here keeps the branch in ONE place. A uuid returns untouched with
 * no request; a slug costs one cached lookup against a public endpoint.
 */
export async function resolveProjectUuid(ref: string): Promise<string | null> {
  if (UUID.test(ref)) return ref;
  try {
    const res = await fetch(`${API_BASE}/v1/projects/${encodeURIComponent(ref)}`, {
      // slug→uuid is immutable for the life of a project, so a burst of clicks
      // is not a burst of lookups.
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { id?: string };
    return body.id && UUID.test(body.id) ? body.id : null;
  } catch {
    return null;
  }
}
