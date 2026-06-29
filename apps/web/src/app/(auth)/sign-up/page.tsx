import type { Metadata } from 'next';
import Link from 'next/link';

import { signUpAction } from '@/lib/auth/actions';

export const metadata: Metadata = { title: 'إنشاء حساب · وثبة' };

const ERROR_MESSAGES: Record<string, string> = {
  missing: 'يرجى إدخال الاسم والبريد الإلكتروني وكلمة المرور.',
  invalid: 'البيانات غير صحيحة. تحقق من البريد الإلكتروني وطول كلمة المرور.',
  taken: 'هذا البريد الإلكتروني مسجّل بالفعل.',
  network: 'تعذّر الاتصال بالخادم. حاول مرة أخرى.',
  server: 'حدث خطأ ما. حاول مرة أخرى.',
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.err ? (ERROR_MESSAGES[sp.err] ?? ERROR_MESSAGES.server) : null;
  const next = sp.next && sp.next.startsWith('/') ? sp.next : '/projects';

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[420px] flex-col justify-center gap-6 px-5 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-bold">إنشاء حساب جديد</h1>
        <p className="mt-2 text-sm text-neutral-600">
          انضم إلى وثبة لتدعم وتطلق المشاريع الإبداعية.
        </p>
      </div>

      <form action={signUpAction} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">الاسم</span>
          <input
            type="text"
            name="name"
            required
            minLength={2}
            maxLength={80}
            autoComplete="name"
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">البريد الإلكتروني</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">كلمة المرور</span>
          <input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
          />
          <span className="text-xs text-neutral-500">٨ أحرف على الأقل.</span>
        </label>

        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          إنشاء الحساب
        </button>
      </form>

      <p className="text-center text-sm text-neutral-600">
        لديك حساب بالفعل؟{' '}
        <Link
          href={`/sign-in?next=${encodeURIComponent(next)}`}
          className="font-semibold text-emerald-700 hover:underline"
        >
          سجّل دخولك
        </Link>
      </p>
    </main>
  );
}
