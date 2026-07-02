import { NextResponse } from 'next/server';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';

/** Browser proxy for `GET /v1/rfqs/:rfqId` — RFQ + bids sorted asc (public read). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ rfqId: string }> },
): Promise<Response> {
  const { rfqId } = await params;
  const r = await fetch(`${API_BASE}/v1/rfqs/${rfqId}`, { cache: 'no-store' });
  const text = await r.text();
  return new NextResponse(text || '{}', {
    status: r.status,
    headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' },
  });
}
