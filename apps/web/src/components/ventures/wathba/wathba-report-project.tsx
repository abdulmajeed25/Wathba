'use client';

import { useState } from 'react';

/**
 * STAKES/K3 — trust & safety: report a project. Subtle text affordance under
 * the campaign rail CTAs; confirm → POST (deduped server-side per reporter).
 * Anonymous users bounce to sign-in with the campaign as ?next.
 */
export function ReportProjectButton({ projectId }: { projectId: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'anon'>('idle');

  const report = async (): Promise<void> => {
    if (state !== 'idle') return;
    if (typeof window !== 'undefined' && !window.confirm('الإبلاغ عن هذا المشروع لفريق وثبة؟')) return;
    setState('busy');
    try {
      const res = await fetch(`/api/projects/${projectId}/report`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.status === 401) {
        setState('anon');
        window.location.href = `/sign-in?next=${encodeURIComponent(`/projects/${projectId}`)}`;
        return;
      }
      setState(res.ok ? 'done' : 'idle');
    } catch {
      setState('idle');
    }
  };

  return (
    <button
      type="button"
      onClick={() => void report()}
      disabled={state === 'done' || state === 'busy'}
      style={{
        background: 'transparent', border: 'none', cursor: state === 'done' ? 'default' : 'pointer',
        fontFamily: 'inherit', fontSize: 12, color: 'var(--muted2)',
        padding: '6px 0', width: '100%', textAlign: 'center', minHeight: 24,
      }}
    >
      {state === 'done' ? 'تم الإبلاغ — شكراً لك ✓' : '🚩 الإبلاغ عن هذا المشروع'}
    </button>
  );
}
