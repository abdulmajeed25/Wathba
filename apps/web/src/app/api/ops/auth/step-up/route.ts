import { proxyWithOpsToken } from '../../_lib';

/** OPS Part 1 — fresh re-auth → 10-minute MONEY/SENSITIVE window. */
export async function POST(req: Request): Promise<Response> {
  return proxyWithOpsToken('/v1/ops/auth/step-up', { body: await req.text() });
}
