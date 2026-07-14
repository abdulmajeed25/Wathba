import { NextResponse } from 'next/server';

import { proxyWithOpsToken } from '../../../_lib';

/**
 * OPS Part 4 — generic BFF proxy for registry calls from ops client
 * components (dry-run / execute / propose). The browser never sees the ops
 * token; the idempotency key passes through when supplied.
 */
const ACTIONS = new Set(['dry-run', 'execute', 'propose']);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ key: string; action: string }> },
): Promise<Response> {
  const { key, action } = await params;
  if (!ACTIONS.has(action) || !/^[a-z0-9.-]+$/i.test(key)) {
    return NextResponse.json({ message: 'مسار غير معروف' }, { status: 404 });
  }
  return proxyWithOpsToken(`/v1/ops/operations/${key}/${action}`, {
    body: await req.text(),
  });
}
