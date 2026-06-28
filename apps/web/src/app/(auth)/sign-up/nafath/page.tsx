import type { Metadata } from 'next';

import { skipNafathAction, verifyNafathAction } from '@/lib/auth/actions';

export const metadata: Metadata = { title: 'تحقّق نفاذ · وثبة' };

const ERR: Record<string, string> = {
  invalid: 'رقم الهوية يجب أن يتكون من ١٠ أرقام.',
  denied:  'تعذّر التحقق من نفاذ. تأكد من قبول الطلب على تطبيق نفاذ ثم حاول مجدداً.',
  server:  'حدث خطأ في الخادم. حاول مجدداً.',
  network: 'تعذّر الاتصال بنفاذ. حاول لاحقاً.',
};

export default async function NafathStepPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.err ? (ERR[sp.err] ?? ERR.server) : null;

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col justify-center gap-6 px-5 py-16">
      <div className="text-center">
        <div
          className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full"
          style={{ background: 'rgba(5,166,97,0.12)' }}
        >
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#05a661" strokeWidth={2.2} aria-hidden>
            <path d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6l8-4z" />
            <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold">تحقّق نفاذ</h1>
        <p className="mt-2 text-sm text-neutral-600">
          خطوة سريعة لتأكيد هويتك الوطنية عبر تطبيق نفاذ. مطلوبة قبل إطلاق أي
          مشروع وقبل سحب أي تمويل.
        </p>
      </div>

      <form action={verifyNafathAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">رقم الهوية الوطنية (١٠ أرقام)</span>
          <input
            type="text"
            name="nationalId"
            required
            inputMode="numeric"
            pattern="[0-9]{10}"
            maxLength={10}
            placeholder="1020304050"
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            dir="ltr"
            style={{ textAlign: 'right' }}
          />
          <span className="text-xs text-neutral-500">
            سيُرسل طلب موافقة إلى تطبيق نفاذ على جوّالك. وافق عليه ثم اضغط متابعة.
          </span>
        </label>

        {error && (
          <div
            className="rounded-md px-3 py-2 text-sm"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#b91c1c' }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          أرسل طلب التحقق
        </button>

        <p className="text-center text-xs text-neutral-500">
          (وضع تطوير: تطبيق نفاذ غير موصول — التحقق يكتمل تلقائياً.)
        </p>
      </form>

      <form action={skipNafathAction}>
        <button
          type="submit"
          className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          أتجاوز هذه الخطوة الآن
        </button>
      </form>
    </main>
  );
}
