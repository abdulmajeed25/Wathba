const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Batch ACCOUNT — turn whatever the client is holding into the project's uuid.
 *
 * A project has TWO public addresses: its uuid and its slug. Pages use the
 * slug (/projects/nakhil-dates) because that is what belongs in a URL, while
 * every mutating endpoint takes the uuid behind a ParseUUIDPipe. Any control
 * that lives on a campaign page therefore holds the wrong one.
 *
 * That mismatch is not hypothetical: the follow and save buttons shipped
 * posting `/api/.../nakhil-dates`, the API 400'd, and the optimistic update
 * rolled back — so the control flipped, flipped back, and wrote nothing. It
 * looked like a UI that worked until the row count was checked.
 *
 * Resolving here keeps the branch in ONE place. A uuid is returned untouched
 * (no request); a slug costs one cached lookup against a public endpoint.
 */
export async function resolveProjectUuid(ref: string): Promise<string | null> {
  if (UUID.test(ref)) return ref;
  try {
    const res = await fetch(`${API_BASE}/v1/projects/${encodeURIComponent(ref)}`, {
      // The slug→uuid mapping is immutable for the life of a project, so this
      // is safe to cache; it stops a burst of clicks becoming a burst of
      // lookups.
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { id?: string };
    return body.id && UUID.test(body.id) ? body.id : null;
  } catch {
    return null;
  }
}
