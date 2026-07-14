'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** OPS Part 1 — revoke the ops session server-side AND clear the cookie. */
export function LeaveButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function leave() {
    setBusy(true);
    try {
      await fetch('/api/ops/auth/leave', { method: 'POST' });
    } finally {
      router.push('/projects/admin');
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={leave}
      disabled={busy}
      className="rounded border border-[#30363d] px-4 py-2 text-sm text-[#8b949e] hover:border-red-500/60 hover:text-red-300 disabled:opacity-50"
    >
      {busy ? 'جارٍ الخروج…' : 'إنهاء الجلسة والخروج'}
    </button>
  );
}
