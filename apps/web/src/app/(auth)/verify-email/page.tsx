import type { Metadata } from 'next';
import Link from 'next/link';

import { resendVerificationAction, verifyEmailAction } from '@/lib/auth/actions';

export const metadata: Metadata = { title: 'تفعيل الحساب · وثبة' };

/**
 * STAKES/S-12 F-11 — the email-verification surface (baseline identity tier).
 *
 * Three states off searchParams:
 *  - ?token=…  → an explicit "فعّل حسابي" button POSTs the token (a GET must
 *    never consume it — mail scanners prefetch links and would burn one-time
 *    tokens before the user ever clicks).
 *  - ?sent=1   → the uniform "افحص بريدك" landing both signup paths share.
 *  - ?err=…    → expiry/invalid copy + the resend form (always-200 upstream).
 */

const ERROR_MESSAGES: Record<string, string> = {
  invalid: 'رابط التفعيل غير صالح.',
  expired: 'انتهت صلاحية رابط التفعيل أو سبق استخدامه — اطلب رابطاً جديداً.',
  network: 'تعذّر الاتصال بالخادم. حاول مرة أخرى.',
  server: 'حدث خطأ ما. حاول مرة أخرى.',
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; next?: string; sent?: string; resent?: string; email?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith('/') && !sp.next.startsWith('//') ? sp.next : '/projects';
  const error = sp.err ? (ERROR_MESSAGES[sp.err] ?? ERROR_MESSAGES.server) : null;

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[420px] flex-col justify-center gap-6 px-5 py-16 text-center">
      {sp.token ? (
        <>
          <h1 className="text-3xl font-bold">تفعيل حسابك</h1>
          <p className="text-sm text-neutral-600">
            اضغط الزر لتفعيل حسابك وتسجيل دخولك مباشرة.
          </p>
          <form action={verifyEmailAction} className="flex flex-col gap-4">
            <input type="hidden" name="token" value={sp.token} />
            <input type="hidden" name="next" value={next} />
            <button
              type="submit"
              className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white hover:bg-emerald-800"
            >
              فعّل حسابي
            </button>
          </form>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-bold">{error ? 'تعذّر التفعيل' : 'افحص بريدك الإلكتروني'}</h1>
          {error ? (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : (
            <p className="text-sm leading-7 text-neutral-600">
              {sp.resent ? 'أعدنا إرسال رابط التفعيل' : 'أرسلنا رابط تفعيل'}
              {sp.email ? ` إلى ${sp.email}` : ' إلى بريدك'}. افتح الرسالة واضغط الرابط
              لتفعيل حسابك وتسجيل دخولك — قد تصل خلال دقائق، وتحقق من مجلد الرسائل غير
              المرغوبة.
            </p>
          )}
          <form action={resendVerificationAction} className="flex flex-col gap-3 text-start">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-neutral-600">لم تصلك الرسالة؟ أدخل بريدك لإعادة الإرسال</span>
              <input
                type="email"
                name="email"
                required
                dir="ltr"
                autoComplete="email"
                className="rounded-xl border border-neutral-300 px-4 py-3 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-xl border border-emerald-600 px-4 py-3 font-bold text-emerald-700 hover:bg-emerald-50"
            >
              إعادة إرسال الرابط
            </button>
          </form>
        </>
      )}
      <p className="text-sm text-neutral-500">
        لديك حساب مفعّل؟{' '}
        <Link href="/sign-in" className="font-bold text-emerald-700 underline">
          سجّل دخولك
        </Link>
      </p>
    </main>
  );
}
