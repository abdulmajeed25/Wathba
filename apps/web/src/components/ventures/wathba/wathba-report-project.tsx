'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

/**
 * STAKES/K3 + S-15 (W4) — trust & safety: report a project WITH a reason.
 * The subtle affordance opens a small reason picker; the chosen reason rides
 * the POST (deduped server-side per reporter). Anonymous users bounce to
 * sign-in with the campaign as ?next. Esc/outside-click close.
 */

const REASONS: Array<{ value: string; label: string }> = [
  { value: 'محتوى مخالف', label: 'محتوى مخالف' },
  { value: 'احتيال مشتبه', label: 'احتيال مشتبه' },
  { value: 'تكرار أو بريد مزعج', label: 'تكرار أو بريد مزعج' },
  { value: 'انتهاك ملكية فكرية', label: 'انتهاك ملكية فكرية' },
];

export function ReportProjectButton({ projectId }: { projectId: string }) {
  const [state, setState] = useState<'idle' | 'open' | 'busy' | 'done'>('idle');
  const [reason, setReason] = useState(REASONS[0]!.value);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (state !== 'open') return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setState('idle');
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setState('idle');
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [state]);

  const submit = async (): Promise<void> => {
    setState('busy');
    try {
      const res = await fetch(`/api/projects/${projectId}/report`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reasonAr: reason }),
      });
      if (res.status === 401) {
        window.location.href = `/sign-in?next=${encodeURIComponent(`/projects/${projectId}`)}`;
        return;
      }
      setState(res.ok ? 'done' : 'idle');
    } catch {
      setState('idle');
    }
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setState((s) => (s === 'idle' ? 'open' : s === 'open' ? 'idle' : s))}
        disabled={state === 'done' || state === 'busy'}
        aria-expanded={state === 'open'}
        style={{
          background: 'transparent', border: 'none', cursor: state === 'done' ? 'default' : 'pointer',
          fontFamily: 'inherit', fontSize: 12, color: 'var(--muted2)',
          padding: '6px 0', width: '100%', textAlign: 'center', minHeight: 24,
        }}
      >
        {state === 'done' ? 'تم الإبلاغ — شكراً لك ✓' : '🚩 الإبلاغ عن هذا المشروع'}
      </button>
      {state === 'open' && (
        <div
          role="dialog"
          aria-label="سبب البلاغ"
          style={{
            position: 'absolute', bottom: 'calc(100% + 8px)', insetInline: 0, zIndex: 70,
            background: 'var(--card)', border: '1px solid rgba(var(--ink-rgb),.12)',
            borderRadius: 13, boxShadow: '0 24px 48px -18px rgba(0,0,0,.45)', padding: 12,
            textAlign: 'start',
          }}
        >
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>سبب البلاغ</div>
          {REASONS.map((r) => (
            <label key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 2px', fontSize: 12.5, color: 'var(--text-soft)', cursor: 'pointer' }}>
              <input
                type="radio"
                name="report-reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                style={{ accentColor: 'var(--accent)' }}
              />
              {r.label}
            </label>
          ))}
          <button
            type="button"
            onClick={() => void submit()}
            style={{
              marginTop: 8, width: '100%', cursor: 'pointer', border: 'none', fontFamily: 'inherit',
              background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 12.5,
              padding: '9px 0', borderRadius: 10,
            }}
          >
            إرسال البلاغ
          </button>
          {/* Batch CONTENT Part 2 — a reporter is asked to judge a project
              against rules the dialog never showed them, then told nothing
              about what their report sets in motion. Both answers live on the
              enforcement page; this is the only place that asks the question. */}
          <Link
            href="/rules/enforcement"
            style={{
              display: 'block', marginTop: 9, fontSize: 11.5, lineHeight: 1.7,
              color: 'var(--muted2)', textAlign: 'center',
            }}
          >
            ما الذي يُعدّ مخالفة؟ وماذا يحدث بعد البلاغ؟
          </Link>
        </div>
      )}
    </div>
  );
}
