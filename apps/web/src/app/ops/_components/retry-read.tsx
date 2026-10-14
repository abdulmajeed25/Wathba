'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

/** Refresh the same route and filters, without relying on a cached self-link. */
export function RetryRead({ label = 'إعادة تحميل البيانات' }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())}
    className="mt-2 inline-block min-h-[44px] rounded px-2 py-3 underline focus-visible:outline-2 focus-visible:outline-[#58a6ff] disabled:opacity-60">
    {pending ? 'جارٍ التحديث…' : label}
  </button>;
}
