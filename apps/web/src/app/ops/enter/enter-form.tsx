'use client';

import { useState, type FormEvent } from 'react';

/** OPS Part 1 — the enter form posts to the BFF, which sets the httpOnly
 *  ops cookie; the raw token never touches client-side JS state beyond the
 *  request/response cycle. */
export function EnterForm() {
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/ops/auth/enter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password, totp: totp || undefined }),
      });
      const body = (await r.json().catch(() => ({}))) as { message?: string | string[] };
      if (!r.ok) {
        setError(Array.isArray(body.message) ? body.message.join('، ') : (body.message ?? 'تعذّر الدخول'));
        return;
      }
      // CLOSEOUT C5 — a HARD navigation, deliberately, not router.push().
      // Entering ops mints a new cookie, and the App Router has already
      // prefetched /ops from BEFORE it existed: those prefetches were 307s to
      // /ops/enter, so a soft push replays the cached redirect and dumps the
      // operator back at the door they just walked through. A full document
      // load re-requests with the new cookie and discards the RSC cache.
      window.location.assign('/ops');
    } catch {
      setError('تعذّر الوصول إلى الخادم');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-[#21262d] bg-[#161b22] p-6">
      <div>
        <label htmlFor="ops-password" className="mb-1 block text-sm text-[#8b949e]">
          كلمة المرور
        </label>
        <input
          id="ops-password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
      </div>
      <div>
        <label htmlFor="ops-totp" className="mb-1 block text-sm text-[#8b949e]">
          رمز التحقق الثنائي <span className="text-[#484f58]">(إن كان مفعّلاً — أو رمز احتياطي)</span>
        </label>
        <input
          id="ops-totp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={totp}
          onChange={(e) => setTotp(e.target.value)}
          className="w-full rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm outline-none focus:border-emerald-500"
          dir="ltr"
        />
      </div>
      {error ? (
        <p role="alert" className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {busy ? 'جارٍ التحقق…' : 'دخول إلى مركز العمليات'}
      </button>
    </form>
  );
}
