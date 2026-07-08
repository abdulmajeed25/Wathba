import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { LiveEmailField } from '@/components/auth/auth-fields';
import { forgotPasswordAction } from '@/lib/auth/actions';
import { getMe } from '@/lib/api/wathba';

export const metadata: Metadata = { title: 'استعادة كلمة المرور · وثبة' };

const ERROR_MESSAGES: Record<string, string> = {
  missing: 'أدخل بريدك الإلكتروني.',
  network: 'تعذّر الاتصال بالخادم. حاول مرة أخرى.',
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.err ? (ERROR_MESSAGES[sp.err] ?? ERROR_MESSAGES.network) : null;

  // STAKES/A16 — signed-in users change their password from settings instead.
  if (await getMe()) redirect('/projects/settings');

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[420px] flex-col justify-center gap-6 px-5 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-bold">استعادة كلمة المرور</h1>
        <p className="mt-2 text-sm text-neutral-600">
          أدخل بريدك الإلكتروني وسنرسل لك رابط تعيين كلمة مرور جديدة.
        </p>
      </div>

      {sp.ok ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center text-sm text-emerald-800">
          إن كان البريد مسجلاً لدينا فستصلك رسالة تحوي رابط الاستعادة خلال دقائق.
          الرابط صالح لمدة ٣٠ دقيقة.
        </div>
      ) : (
        <form action={forgotPasswordAction} className="flex flex-col gap-4">
          <LiveEmailField />
          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            إرسال رابط الاستعادة
          </button>
        </form>
      )}

      <p className="text-center text-sm text-neutral-600">
        تذكرت كلمة المرور؟{' '}
        <Link href="/sign-in" className="font-semibold text-emerald-700 underline">
          تسجيل الدخول
        </Link>
      </p>
    </main>
  );
}
