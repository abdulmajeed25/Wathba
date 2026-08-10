import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { LiveEmailField, LiveNameField, PasswordField } from '@/components/auth/auth-fields';
import { TurnstileSlot } from '@/components/auth/turnstile-slot';
import { signUpAction } from '@/lib/auth/actions';
import { destinationFor } from '@/lib/auth/guard';
import { getMe } from '@/lib/api/wathba';

export const metadata: Metadata = { title: 'إنشاء حساب · وثبة' };

const ERROR_MESSAGES: Record<string, string> = {
  missing: 'يرجى إدخال الاسم والبريد الإلكتروني وكلمة المرور.',
  consent: 'يجب الموافقة على الشروط وسياسة الخصوصية للمتابعة.',
  invalid: 'البيانات غير صحيحة. تحقق من البريد الإلكتروني وطول كلمة المرور.',
  taken:
    'تعذّر إنشاء الحساب بهذه البيانات. إن كان لديك حساب سابق فسجّل دخولك أو استعد كلمة المرور.',
  throttle: 'محاولات كثيرة خلال دقيقة — انتظر قليلاً ثم حاول مجدداً.',
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
  const next = sp.next && sp.next.startsWith('/') && !sp.next.startsWith('//') ? sp.next : '/projects';

  // STAKES/A16 — already signed in ⇒ honor the deep-link instead of re-signup.
  const me = await getMe();
  if (me) redirect(sp.next && sp.next.startsWith('/') ? next : destinationFor(me));

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[420px] flex-col justify-center gap-6 px-5 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-bold">إنشاء حساب جديد</h1>
        <p className="mt-2 text-sm text-fg-muted">
          انضم إلى وثبة لتدعم وتطلق المشاريع الإبداعية.
        </p>
      </div>

      <form action={signUpAction} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <LiveNameField />
        <LiveEmailField />
        <PasswordField autoComplete="new-password" withStrength hint="٨ أحرف على الأقل — أضف أرقاماً ورموزاً لتقويتها." />

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="acceptTerms"
            required
            className="mt-1 h-4 w-4 accent-[var(--brand-primary)]"
          />
          <span className="text-fg-muted">
            أوافق على{' '}
            <Link href="/projects/legal/terms" className="text-brand-ink underline">
              الشروط والأحكام
            </Link>{' '}
            و{' '}
            <Link href="/projects/legal/privacy" className="text-brand-ink underline">
              سياسة الخصوصية (PDPL)
            </Link>
            .
          </span>
        </label>

        {error ? (
          <p role="alert" className="text-sm text-err">
            {error}
          </p>
        ) : null}
        <TurnstileSlot />

        <button
          type="submit"
          className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-on-brand transition hover:bg-brand"
        >
          إنشاء الحساب
        </button>
      </form>

      <p className="text-center text-sm text-fg-muted">
        لديك حساب بالفعل؟{' '}
        <Link
          href={`/sign-in?next=${encodeURIComponent(next)}`}
          className="font-semibold text-brand-ink hover:underline"
        >
          سجّل دخولك
        </Link>
      </p>
    </main>
  );
}
