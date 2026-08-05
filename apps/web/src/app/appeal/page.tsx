import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AppealForm, type MyAppeal } from './appeal-form';

/**
 * OPS-GAPS R1 — the appellant's LOCKED appeal surface.
 *
 * A banned user is routed here after sign-in (the sign-in response carries
 * `suspended:true`, and signInAction redirects to /appeal instead of the app).
 * It shows the account is suspended and lets them file ONE account-ban appeal
 * (POST /v1/appeals {kind:'ACCOUNT_BAN', subjectId:<own userId>}). It also
 * doubles as the rejected-project appeal entry point via `?project=<id>`
 * (kind:'PROJECT_REJECTION', subjectId:<projectId>).
 *
 * The own userId is read from the session JWT's `sub` claim — a suspended token
 * grants only appeal access, so we must not depend on /v1/users/me here.
 */

export const metadata: Metadata = { title: 'تقديم تظلّم · وثبة' };

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/** Decode a JWT's `sub` (userId) without verifying — display/subjectId only. */
function jwtSub(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const claims = JSON.parse(json) as { sub?: string; userId?: string; id?: string };
    return claims.sub ?? claims.userId ?? claims.id ?? null;
  } catch {
    return null;
  }
}

async function loadMyAppeals(token: string): Promise<MyAppeal[] | null> {
  try {
    const r = await fetch(`${API_BASE}/v1/appeals/mine`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!r.ok) return null; // 404 (route building) / 401 → treat as none yet
    const body = (await r.json()) as { items?: MyAppeal[] } | MyAppeal[];
    return Array.isArray(body) ? body : (body.items ?? []);
  } catch {
    return null;
  }
}

export default async function AppealPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const sp = await searchParams;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect('/sign-in?next=/appeal');

  const projectId = sp.project?.trim();
  const kind: 'ACCOUNT_BAN' | 'PROJECT_REJECTION' = projectId ? 'PROJECT_REJECTION' : 'ACCOUNT_BAN';
  const kindLabelAr = projectId ? 'رفض المشروع' : 'حظر الحساب';

  const ownUserId = jwtSub(token!);
  const subjectId = projectId ?? ownUserId ?? '';

  const appeals = await loadMyAppeals(token!);
  const existing =
    appeals?.find((a) => a.subjectId === subjectId && a.kind === kind) ?? null;

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[560px] flex-col justify-center gap-6 px-5 py-16">
      <header className="space-y-2 text-center">
        {kind === 'ACCOUNT_BAN' ? (
          <span className="inline-block rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
            الحساب موقوف
          </span>
        ) : (
          <span className="inline-block rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
            مشروع مرفوض
          </span>
        )}
        <h1 className="text-2xl font-bold">تقديم تظلّم</h1>
        <p className="text-sm text-neutral-600">
          {kind === 'ACCOUNT_BAN'
            ? 'تم إيقاف حسابك عن الوصول للمنصة. إن كنت ترى أن القرار غير صحيح، يمكنك تقديم تظلّم واحد ليراجعه فريق العمليات.'
            : 'رُفض هذا المشروع في المراجعة. يمكنك تقديم تظلّم واحد ليعيد فريق العمليات النظر في القرار.'}
        </p>
      </header>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        {subjectId ? (
          <AppealForm
            kind={kind}
            subjectId={subjectId}
            kindLabelAr={kindLabelAr}
            existing={existing}
          />
        ) : (
          <p className="text-sm text-amber-700">
            تعذّر تحديد هويّة الحساب من الجلسة — سجّل الدخول من جديد ثم أعد المحاولة.
          </p>
        )}
      </section>

      {appeals === null ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs text-amber-700">
          خدمة التظلّمات قيد الإنشاء أو غير متاحة حالياً — يمكنك المحاولة، وسنحفظ طلبك عند تفعيلها.
        </p>
      ) : null}

      {/* Batch CONTENT Part 2 — the appellant is asked to argue against a
          decision without being shown the rules it was made under, or how the
          review that follows works. Both are on the enforcement page. */}
      <p className="text-center text-sm text-neutral-500">
        <Link href="/rules/enforcement" className="text-emerald-700 hover:underline">
          كيف تُتَّخذ قرارات الإنفاذ وكيف يُراجَع التظلّم
        </Link>
      </p>

      <p className="text-center text-sm text-neutral-500">
        <Link href="/sign-in" className="text-emerald-700 hover:underline">
          العودة لتسجيل الدخول
        </Link>
      </p>
    </main>
  );
}
