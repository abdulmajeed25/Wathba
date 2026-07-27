import type { Metadata } from 'next';
import Link from 'next/link';

import { PasswordField } from '@/components/auth/auth-fields';
import { resetPasswordAction } from '@/lib/auth/actions';

export const metadata: Metadata = { title: 'تعيين كلمة مرور جديدة · وثبة' };

const ERROR_MESSAGES: Record<string, string> = {
  short: 'كلمة المرور يجب أن تكون ٨ أحرف على الأقل.',
  mismatch: 'كلمتا المرور غير متطابقتين.',
  invalid: 'الرابط غير صالح أو منتهي الصلاحية — اطلب رابطاً جديداً.',
  network: 'تعذّر الاتصال بالخادم. حاول مرة أخرى.',
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const token = sp.token ?? '';
  const error = sp.err ? (ERROR_MESSAGES[sp.err] ?? ERROR_MESSAGES.network) : null;

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[420px] flex-col justify-center gap-6 px-5 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-bold">تعيين كلمة مرور جديدة</h1>
        <p className="mt-2 text-sm text-neutral-600">
          اختر كلمة مرور قوية — سيُسجَّل خروجك من جميع الأجهزة بعد التغيير.
        </p>
      </div>

      {!token ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
          الرابط ناقص — افتح رابط الاستعادة من بريدك، أو{' '}
          <Link href="/forgot-password" className="font-semibold underline">
            اطلب رابطاً جديداً
          </Link>
          .
        </div>
      ) : (
        <form action={resetPasswordAction} className="flex flex-col gap-4">
          <input type="hidden" name="token" value={token} />
          <PasswordField
            label="كلمة المرور الجديدة"
            autoComplete="new-password"
            withStrength
            hint="٨ أحرف على الأقل — أضف أرقاماً ورموزاً لتقويتها."
          />
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">تأكيد كلمة المرور</span>
            <input
              type="password"
              name="confirm"
              required
              minLength={8}
              autoComplete="new-password"
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
          >
            حفظ كلمة المرور
          </button>
        </form>
      )}
    </main>
  );
}
