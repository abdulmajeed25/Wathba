import { NextResponse } from 'next/server';

import { proxyWithOpsToken } from '../../_lib';

/**
 * OPS Part 5 — generic READ passthrough. Any GET under `/v1/ops/*` becomes
 * reachable from an ops client island through one route (mirror of the
 * generic operations mutation proxy) so screens don't need a per-endpoint
 * BFF file. The browser never sees the raw ops token; querystring passes
 * through untouched. Path segments are constrained to the ops-safe charset.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await params;
  if (!path?.length || path.some((seg) => !/^[a-z0-9._-]+$/i.test(seg))) {
    return NextResponse.json({ message: 'مسار قراءة غير معروف' }, { status: 404 });
  }
  const search = new URL(req.url).search;
  return proxyWithOpsToken(`/v1/ops/${path.join('/')}${search}`, { method: 'GET' });
}
