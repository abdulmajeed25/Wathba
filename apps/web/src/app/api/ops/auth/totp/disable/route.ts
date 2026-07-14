import { proxyWithOpsToken } from '../../../_lib';

/** OPS Part 1 — disable TOTP (refused server-side while OPS_TOTP_REQUIRED=1). */
export async function POST(req: Request): Promise<Response> {
  return proxyWithOpsToken('/v1/ops/auth/totp/disable', { body: await req.text() });
}
