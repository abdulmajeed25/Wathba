import { NextResponse } from 'next/server';
import { parsePledgePolicy } from '@/lib/payments/pledge-policy';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const base = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
    const response = await fetch(`${base}/v1/platform/pledge-policy`, { cache: 'no-store' });
    const policy = response.ok ? parsePledgePolicy(await response.json()) : null;
    if (policy) return NextResponse.json(policy, { headers: { 'Cache-Control': 'no-store' } });
  } catch { /* An unavailable policy must not enable a new payment. */ }
  return NextResponse.json({ message: 'تعذر تحميل إعدادات الدعم. أعد المحاولة.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}
