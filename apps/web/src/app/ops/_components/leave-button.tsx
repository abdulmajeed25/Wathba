'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** OPS Part 1 — revoke the ops session server-side AND clear the cookie. */
export function LeaveButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function leave() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/ops/auth/leave', { method: 'POST' });
      if (!response.ok && response.status !== 401) throw new Error('leave failed');
      router.push('/projects');
      router.refresh();
    } catch {
      setError('تعذر التأكد من إنهاء جلسة الإدارة؛ أعد المحاولة.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
    <button
      type="button"
      onClick={leave}
      disabled={busy}
      className="rounded border border-[#30363d] px-4 py-2 text-sm text-[#8b949e] hover:border-red-500/60 hover:text-red-300 disabled:opacity-50"
    >
      {busy ? 'جارٍ الخروج…' : 'إنهاء الجلسة والخروج'}
    </button>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
