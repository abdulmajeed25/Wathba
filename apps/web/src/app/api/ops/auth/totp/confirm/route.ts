import { proxyWithOpsToken } from '../../../_lib';

/** OPS Part 1 — confirm TOTP; the 10 backup codes pass through ONCE. */
export async function POST(req: Request): Promise<Response> {
  return proxyWithOpsToken('/v1/ops/auth/totp/confirm', { body: await req.text() });
}
