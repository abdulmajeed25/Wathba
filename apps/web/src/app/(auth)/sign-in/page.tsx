import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { LiveEmailField, PasswordField } from '@/components/auth/auth-fields';
import { signInAction } from '@/lib/auth/actions';
import { destinationFor } from '@/lib/auth/guard';
import { getMe } from '@/lib/api/wathba';

export const metadata: Metadata = { title: 'تسجيل الدخول · وثبة' };

const ERROR_MESSAGES: Record<string, string> = {
  missing: 'يرجى إدخال البريد الإلكتروني وكلمة المرور.',
  invalid: 'بيانات الدخول غير صحيحة.',
  network: 'تعذّر الاتصال بالخادم. حاول مرة أخرى.',
  server: 'حدث خطأ ما. حاول مرة أخرى.',
  reset_ok: 'تم تغيير كلمة المرور بنجاح — سجّل دخولك بكلمتك الجديدة.',
};

/** STAKES/A9 P2 — human Arabic lockout copy with the remaining time. */
function lockedMessage(waitSec: number): string {
  if (waitSec <= 0) return 'محاولات دخول كثيرة — انتظر قليلاً ثم حاول مجدداً.';
  const min = Math.ceil(waitSec / 60);
  return min > 1
    ? `محاولات دخول كثيرة — حاول بعد ${min.toLocaleString('ar-SA')} دقائق.`
    : `محاولات دخول كثيرة — حاول بعد ${waitSec.toLocaleString('ar-SA')} ثانية.`;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; next?: string; wait?: string }>;
}) {
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith('/') && !sp.next.startsWith('//') ? sp.next : '/projects';

  // STAKES/A16 — already signed in ⇒ this page has no job; honor the deep-link.
  const me = await getMe();
  if (me) redirect(sp.next && sp.next.startsWith('/') ? next : destinationFor(me));

  const error = sp.err
    ? sp.err === 'locked'
      ? lockedMessage(Number(sp.wait ?? 0))
      : (ERROR_MESSAGES[sp.err] ?? ERROR_MESSAGES.server)
    : null;

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[420px] flex-col justify-center gap-6 px-5 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-bold">تسجيل الدخول</h1>
        <p className="mt-2 text-sm text-neutral-600">
          ادخل إلى حسابك لمتابعة دعم المشاريع وإطلاقها.
        </p>
      </div>

      <form action={signInAction} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <LiveEmailField />
        <PasswordField autoComplete="current-password" />

        <div className="flex items-center justify-between text-xs">
          {/* STAKES/S-12 F-17 — session-length choice: unchecked = browser-session cookies. */}
          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <input type="checkbox" name="remember" defaultChecked className="h-4 w-4 accent-emerald-600" />
            تذكرني
          </label>
          <Link href="/forgot-password" className="text-emerald-700 underline">
            نسيت كلمة المرور؟
          </Link>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          تسجيل الدخول
        </button>
      </form>

      <p className="text-center text-sm text-neutral-600">
        ليس لديك حساب؟{' '}
        <Link
          href={`/sign-up?next=${encodeURIComponent(next)}`}
          className="font-semibold text-emerald-700 hover:underline"
        >
          أنشئ حساباً جديداً
        </Link>
      </p>
    </main>
  );
}
