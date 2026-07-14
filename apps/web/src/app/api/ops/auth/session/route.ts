import { proxyWithOpsToken } from '../../_lib';

/** OPS Part 1 — ops-session introspection for the /ops shell. */
export async function GET(): Promise<Response> {
  return proxyWithOpsToken('/v1/ops/auth/session', { method: 'GET' });
}
