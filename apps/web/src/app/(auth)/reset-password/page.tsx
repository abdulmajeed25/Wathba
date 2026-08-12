import type { Metadata } from 'next';
import Link from 'next/link';

import { PasswordField } from '@/components/auth/auth-fields';
import { resetPasswordAction } from '@/lib/auth/actions';

export const metadata: Metadata = { title: 'تعيين كلمة مرور جديدة · وثبة' };

const ERROR_MESSAGES: Record<string, string> = {
  short: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.',
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
        <p className="mt-2 text-sm text-fg-muted">
          اختر كلمة مرور قوية — سيُسجَّل خروجك من جميع الأجهزة بعد التغيير.
        </p>
      </div>

      {!token ? (
        <div className="rounded-lg border border-err bg-elevated p-4 text-center text-sm text-err">
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
            hint="8 أحرف على الأقل — أضف أرقاماً ورموزاً لتقويتها."
          />
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">تأكيد كلمة المرور</span>
            <input
              type="password"
              name="confirm"
              required
              minLength={8}
              autoComplete="new-password"
              className="rounded-lg border border-edge-strong bg-elevated px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-err">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-on-brand transition hover:bg-brand"
          >
            حفظ كلمة المرور
          </button>
        </form>
      )}
    </main>
  );
}
