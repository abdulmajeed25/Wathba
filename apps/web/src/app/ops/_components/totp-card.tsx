'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * OPS Part 1 — TOTP enrollment: setup (password-gated) → scan/copy the
 * secret → confirm with a live code → the 10 backup codes are shown ONCE
 * and never again. Disable is refused server-side while OPS_TOTP_REQUIRED=1.
 */
export function TotpCard({ enabled, required }: { enabled: boolean; required: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<'idle' | 'setup' | 'codes'>('idle');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [secret, setSecret] = useState('');
  const [otpauth, setOtpauth] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function call(path: string, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/ops/auth/totp/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const out = (await r.json().catch(() => ({}))) as Record<string, unknown> & {
        message?: string | string[];
      };
      if (!r.ok) {
        setError(Array.isArray(out.message) ? out.message.join('، ') : ((out.message as string) ?? 'تعذّر التنفيذ'));
        return null;
      }
      return out;
    } catch {
      setError('تعذّر الوصول إلى الخادم');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function beginSetup() {
    const out = await call('setup', { password });
    if (!out) return;
    setSecret(out.secret as string);
    setOtpauth(out.otpauth as string);
    setPhase('setup');
  }

  async function confirm() {
    const out = await call('confirm', { code });
    if (!out) return;
    setBackupCodes(out.backupCodes as string[]);
    setPhase('codes');
  }

  return (
    <section className="rounded-lg border border-[#21262d] bg-[#161b22] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold">التحقق الثنائي (TOTP)</h2>
        {enabled ? (
          <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
            مفعّل
          </span>
        ) : (
          <span className="rounded border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[11px] text-red-300">
            غير مفعّل{required ? ' — إلزامي' : ''}
          </span>
        )}
      </div>

      {enabled ? (
        <p className="text-xs text-[#8b949e]">
          التحقق الثنائي يعمل على هذا الحساب. الدخول وإعادة التوثيق يتطلبان رمزاً
          حياً أو رمزاً احتياطياً.
          {required ? ' التعطيل مرفوض بسياسة المنصة (OPS_TOTP_REQUIRED).' : ''}
        </p>
      ) : phase === 'idle' ? (
        <div className="space-y-3">
          <p className="text-xs text-[#8b949e]">
            فعّل تطبيق مصادقة (Google Authenticator / 1Password / Authy): أدخل كلمة
            المرور لبدء الإعداد.
          </p>
          <input
            type="password"
            placeholder="كلمة المرور"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={beginSetup}
            disabled={busy || !password}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? 'جارٍ الإعداد…' : 'بدء الإعداد'}
          </button>
        </div>
      ) : phase === 'setup' ? (
        <div className="space-y-3">
          <p className="text-xs text-[#8b949e]">
            أضف هذا السر إلى تطبيق المصادقة ثم أكّد برمز حي:
          </p>
          <code className="block break-all rounded border border-[#30363d] bg-[#0d1117] p-3 text-xs" dir="ltr">
            {secret}
          </code>
          <code className="block break-all rounded border border-[#30363d] bg-[#0d1117] p-3 text-[10px] text-[#8b949e]" dir="ltr">
            {otpauth}
          </code>
          <input
            type="text"
            inputMode="numeric"
            placeholder="الرمز من التطبيق"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm outline-none focus:border-emerald-500"
            dir="ltr"
          />
          <button
            type="button"
            onClick={confirm}
            disabled={busy || !code}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? 'جارٍ التأكيد…' : 'تأكيد التفعيل'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            الرموز الاحتياطية — تُعرض هذه المرة فقط. احفظها في مكان آمن؛ كل رمز
            يعمل مرة واحدة.
          </p>
          <div className="grid grid-cols-2 gap-2 rounded border border-[#30363d] bg-[#0d1117] p-3" dir="ltr">
            {backupCodes.map((c) => (
              <code key={c} className="text-xs">
                {c}
              </code>
            ))}
          </div>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500"
          >
            حفظتها — متابعة
          </button>
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-3 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </section>
  );
}
