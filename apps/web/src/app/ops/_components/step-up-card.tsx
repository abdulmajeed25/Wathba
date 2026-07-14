'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

/**
 * OPS Part 1 — step-up: password (+TOTP when enrolled) re-entry unlocks
 * MONEY/SENSITIVE operations for 10 minutes.
 */
export function StepUpCard({
  fresh,
  stepUpAt,
  totpEnabled,
}: {
  fresh: boolean;
  stepUpAt: string | null;
  totpEnabled: boolean;
}) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/ops/auth/step-up', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password, totp: totp || undefined }),
      });
      const body = (await r.json().catch(() => ({}))) as { message?: string | string[] };
      if (!r.ok) {
        setError(Array.isArray(body.message) ? body.message.join('، ') : (body.message ?? 'تعذّر التوثيق'));
        return;
      }
      setPassword('');
      setTotp('');
      router.refresh();
    } catch {
      setError('تعذّر الوصول إلى الخادم');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-[#21262d] bg-[#161b22] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold">إعادة التوثيق (Step-up)</h2>
        {fresh ? (
          <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
            نشط — عمليات المال متاحة
          </span>
        ) : (
          <span className="rounded border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[11px] text-red-300">
            منتهٍ — عمليات المال مقفلة
          </span>
        )}
      </div>
      <p className="mb-4 text-xs text-[#8b949e]">
        عمليات المال والصلاحيات تتطلب إعادة إدخال كلمة المرور خلال آخر ١٠ دقائق.
        {stepUpAt ? ` آخر توثيق: ${new Date(stepUpAt).toLocaleTimeString('ar-SA')}.` : ''}
      </p>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="password"
          required
          placeholder="كلمة المرور"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
        {totpEnabled ? (
          <input
            type="text"
            inputMode="numeric"
            placeholder="رمز التحقق الثنائي"
            autoComplete="one-time-code"
            value={totp}
            onChange={(e) => setTotp(e.target.value)}
            className="w-full rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm outline-none focus:border-emerald-500"
            dir="ltr"
          />
        ) : null}
        {error ? (
          <p role="alert" className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? 'جارٍ التوثيق…' : 'إعادة التوثيق الآن'}
        </button>
      </form>
    </section>
  );
}
