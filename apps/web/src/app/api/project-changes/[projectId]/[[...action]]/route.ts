import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

type Context = { params: Promise<{ projectId: string; action?: string[] }> };
async function proxy(req: Request, context: Context) {
  const { projectId, action = [] } = await context.params;
  const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
  if (!uuid.test(projectId) || (action.length && !(req.method === 'POST' && action.length === 2 && uuid.test(action[0]!) && action[1] === 'withdraw'))) {
    return NextResponse.json({ message: 'المسار غير موجود' }, { status: 404 });
  }
  const token = (await cookies()).get('wathba_session')?.value;
  if (!token) return NextResponse.json({ message: 'سجّل الدخول للمتابعة' }, { status: 401 });
  const base = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
  const cursor = new URL(req.url).searchParams.get('cursor');
  if (cursor && !uuid.test(cursor)) return NextResponse.json({ message: 'رابط الصفحة غير صالح' }, { status: 400 });
  try {
    const upstream = await fetch(`${base}/v1/projects/${projectId}/change-requests${action.length ? `/${action.join('/')}` : ''}${req.method === 'GET' && cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, {
      method: req.method, cache: 'no-store',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      ...(req.method === 'POST' ? { body: action.length ? '{}' : await req.text() } : {}),
    });
    return new NextResponse(await upstream.text(), { status: upstream.status, headers: { 'content-type': 'application/json' } });
  } catch {
    return NextResponse.json({ message: 'تعذر الاتصال؛ بياناتك ما زالت في النموذج ويمكنك إعادة المحاولة' }, { status: 503 });
  }
}
export const GET = proxy;
export const POST = proxy;
