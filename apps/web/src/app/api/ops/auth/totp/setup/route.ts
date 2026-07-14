import { proxyWithOpsToken } from '../../../_lib';

/** OPS Part 1 — begin TOTP enrollment (password-gated). */
export async function POST(req: Request): Promise<Response> {
  return proxyWithOpsToken('/v1/ops/auth/totp/setup', { body: await req.text() });
}
