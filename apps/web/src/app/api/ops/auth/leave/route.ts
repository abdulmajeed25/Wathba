import { OPS_COOKIE, proxyWithOpsToken } from '../../_lib';

/** OPS Part 1 — revoke the ops session server-side AND drop the cookie. */
export async function POST(): Promise<Response> {
  const r = await proxyWithOpsToken('/v1/ops/auth/leave');
  const headers = new Headers(r.headers);
  headers.append(
    'set-cookie',
    `${OPS_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`,
  );
  return new Response(await r.text(), { status: r.status, headers });
}
