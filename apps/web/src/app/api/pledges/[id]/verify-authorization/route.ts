import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const token = (await cookies()).get('wathba_session')?.value;
  if (!token) return NextResponse.json({ message: 'يلزم تسجيل الدخول.' }, { status: 401 });
  // Next may reconstruct req.url using its internal hostname. Host retains
  // the browser-facing authority; a configured public URL takes precedence.
  const expectedOrigin = process.env.WEB_BASE_URL
    ? new URL(process.env.WEB_BASE_URL).origin
    : `${new URL(req.url).protocol}//${req.headers.get('host')}`;
  if (req.headers.get('origin') && req.headers.get('origin') !== expectedOrigin)
    return NextResponse.json({ message: 'مصدر الطلب غير صالح.' }, { status: 403 });
  const { id } = await ctx.params;
  try {
    const result = await fetch(`${API_BASE}/v1/pledges/${encodeURIComponent(id)}/verify-authorization`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    });
    return new NextResponse(await result.text(), { status: result.status, headers: { 'content-type': 'application/json' } });
  } catch {
    return NextResponse.json({ message: 'تعذر قراءة نتيجة الحجز؛ لا تدفع مجددًا قبل التحقق.' }, { status: 503 });
  }
}
