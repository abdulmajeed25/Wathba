/**
 * Authenticated browser-side fetch client for the Wathba (وثبة) Next.js
 * frontend.  Pairs with the NestJS API in `apps/api/` (default base URL
 * `http://localhost:4000`, all routes prefixed `/v1`).
 *
 * Auth flow:
 *   1.  /sign-in and /sign-up POST to apps/api `/auth/signin|signup` and
 *       receive `{ accessToken, user }`.
 *   2.  The token is set as an httpOnly cookie (`wathba_session`) via a
 *       server action; SSR fetchers read it via `next/headers.cookies()`
 *       and forward it as `Authorization: Bearer …`.
 *   3.  This client mirrors the token in-memory for in-page CSR calls.
 *
 * Kept deliberately minimal — no DictKey-bound i18n surface here; this app's
 * dictionary is only the `ventures` namespace.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    detail?: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(detail ?? code);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Skip the bearer header (sign-in / sign-up themselves). */
  anonymous?: boolean;
}

/* Access token lives in memory only — never localStorage. The httpOnly
 * cookie is the cross-navigation source of truth; this is a per-tab fast path. */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

async function send(
  path: string,
  { method = 'GET', body, signal, anonymous }: RequestOptions,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (!anonymous && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  try {
    return await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
      signal,
    });
  } catch (cause) {
    if (signal?.aborted && cause instanceof Error) throw cause;
    throw new ApiError(0, 'NETWORK');
  }
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await send(path, options);
  if (!res.ok) {
    if (res.status === 401) accessToken = null;
    const payload = (await res.json().catch(() => null)) as {
      code?: string;
      message?: string;
      details?: Record<string, unknown>;
    } | null;
    throw new ApiError(
      res.status,
      payload?.code ?? `HTTP_${res.status}`,
      payload?.message,
      payload?.details,
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
