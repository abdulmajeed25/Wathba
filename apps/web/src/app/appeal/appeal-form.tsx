'use client';

import { useState } from 'react';

/**
 * OPS-GAPS R1 — appellant appeal form (locked-account ban appeal, or a rejected
 * project appeal). Submits POST /api/appeals (→ /v1/appeals) with the user's
 * bearer via the BFF, and reflects an existing appeal's status so a second
 * submit is prevented client-side. Degrades to an amber note if the endpoint
 * is still being built (404).
 */

export interface MyAppeal {
  id: string;
  kind: string;
  subjectId: string;
  status: string;
  reasonAr?: string | null;
  outcome?: string | null;
  createdAt?: string;
  decidedAt?: string | null;
}

const STATUS_LABEL_AR: Record<string, string> = {
  SUBMITTED: 'مُقدَّم — بانتظار المراجعة',
  UNDER_REVIEW: 'قيد المراجعة',
  UPHELD: 'رُفض التظلّم — بقي القرار',
  OVERTURNED: 'قُبل التظلّم — أُلغي القرار',
  PARTIALLY_GRANTED: 'قُبل التظلّم جزئياً',
};

function statusLabel(s: string): string {
  return STATUS_LABEL_AR[s] ?? s;
}

function isOpen(s: string): boolean {
  return s === 'SUBMITTED' || s === 'UNDER_REVIEW';
}

export function AppealForm({
  kind,
  subjectId,
  kindLabelAr,
  existing,
}: {
  kind: 'ACCOUNT_BAN' | 'PROJECT_REJECTION';
  subjectId: string;
  kindLabelAr: string;
  existing: MyAppeal | null;
}) {
  const [current, setCurrent] = useState<MyAppeal | null>(existing);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reasonOk = reason.trim().length >= 20;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reasonOk || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/appeals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, subjectId, reasonAr: reason.trim() }),
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.status === 404) {
        setError('خدمة التظلّمات قيد الإنشاء — حاول لاحقاً.');
        return;
      }
      if (res.status === 401) {
        setError('انتهت الجلسة — سجّل الدخول من جديد.');
        return;
      }
      if (res.status === 409) {
        setError('لديك تظلّم قائم على هذا القرار بالفعل.');
        return;
      }
      if (!res.ok) {
        const msg = (body.message as string) ?? 'تعذّر إرسال التظلّم.';
        setError(Array.isArray(msg) ? (msg as unknown as string[]).join('، ') : String(msg));
        return;
      }
      // Success — reflect the new appeal (accept the returned row, else synthesize).
      const created =
        (body as { appeal?: MyAppeal }).appeal ??
        (body.id ? (body as unknown as MyAppeal) : null) ?? {
          id: 'new',
          kind,
          subjectId,
          status: 'SUBMITTED',
          reasonAr: reason.trim(),
        };
      setCurrent(created);
      setReason('');
    } catch {
      setError('تعذّر الوصول إلى الخادم.');
    } finally {
      setBusy(false);
    }
  }

  // An existing OPEN appeal blocks re-submission; a decided one is shown as history.
  if (current) {
    const open = isOpen(current.status);
    return (
      <div className="space-y-3">
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            open
              ? 'border-amber-400 bg-amber-50 text-amber-900'
              : current.status === 'OVERTURNED' || current.status === 'PARTIALLY_GRANTED'
                ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
                : 'border-red-300 bg-red-50 text-red-900'
          }`}
        >
          <p className="font-bold">تظلّم «{kindLabelAr}»</p>
          <p className="mt-1">الحالة: {statusLabel(current.status)}</p>
          {current.reasonAr ? (
            <p className="mt-2 text-[13px] opacity-80">حجّتك: {current.reasonAr}</p>
          ) : null}
        </div>
        {open ? (
          <p className="text-sm text-neutral-600">
            تظلّمك قيد النظر — لا يمكن تقديم تظلّم آخر على القرار نفسه. سنُعلمك بالنتيجة.
          </p>
        ) : (
          <p className="text-sm text-neutral-600">تم حسم هذا التظلّم.</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-neutral-700">
          اشرح سبب تظلّمك (٢٠ حرفاً على الأقل)
        </span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={5}
          minLength={20}
          required
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          placeholder="وضّح لماذا ترى أن القرار غير صحيح، مع أي سياق مفيد."
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!reasonOk || busy}
        className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? 'جارٍ الإرسال…' : 'تقديم تظلّم'}
      </button>
    </form>
  );
}
