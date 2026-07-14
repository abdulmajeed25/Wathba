import { proxyWithOpsToken } from '../_lib';

/** OPS Part 4 — «الوكلاء» list + kill-switch state (agents.manage). */
export async function GET(): Promise<Response> {
  return proxyWithOpsToken('/v1/ops/agents', { method: 'GET' });
}
