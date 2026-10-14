'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <section dir="rtl" className="mx-auto max-w-xl space-y-5 p-8" role="alert">
    <h1 className="text-2xl font-bold">تعذر تحميل مساحة المشروع</h1>
    <p>لم نتمكن من الوصول إلى البيانات الآن. أعد المحاولة، أو عد إلى قائمة مشاريعك.</p>
    <div className="flex flex-wrap gap-4">
      <button type="button" disabled={pending} className="rounded-lg bg-emerald-800 px-5 py-3 text-white" onClick={() => startTransition(() => { router.refresh(); reset(); })}>{pending ? 'جارٍ المحاولة…' : 'إعادة المحاولة'}</button>
      <Link className="px-4 py-3 underline" href="/projects/dashboard">قائمة مشاريعي</Link>
    </div>
  </section>;
}
