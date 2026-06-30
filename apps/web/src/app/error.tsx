'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Global error boundary — catches any unhandled exception in a client
 * component (server-component errors fall to Next's default UI). Arabic-
 * first; RTL inherits from the root layout.
 *
 * Next will pass us `reset()` to retry the broken sub-tree without a full
 * navigation. We surface that plus a "back to home" link so the user is
 * never stuck on a blank screen.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  useEffect(() => {
    // Server-side observability hook — pipe to Sentry / Datadog once
    // configured. For now, console so devs notice during local work.
    console.error('GlobalError boundary caught:', error);
  }, [error]);

  return (
    <main
      dir="rtl"
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '48px 24px',
        textAlign: 'center',
        fontFamily: 'inherit',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'rgba(239,68,68,0.10)',
          color: 'var(--err, #dc2626)',
          display: 'grid',
          placeItems: 'center',
          fontSize: 32,
          fontWeight: 700,
        }}
      >
        !
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>صار خطأ غير متوقع</h1>
      <p style={{ color: 'var(--muted)', maxWidth: 420, lineHeight: 1.6, fontSize: 14 }}>
        ما قدرنا نعرض الصفحة دحين. جرّب من جديد، وإذا تكرّر الخطأ ارجع للرئيسية.
      </p>
      {error.digest && (
        <p style={{ color: 'var(--muted2, #6b7280)', fontSize: 12, fontFamily: 'monospace' }}>
          الرمز المرجعي: {error.digest}
        </p>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            background: 'var(--grad)',
            color: 'var(--on-accent)',
            fontWeight: 700,
            fontSize: 14,
            padding: '10px 20px',
            borderRadius: 12,
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          حاول مرة ثانية
        </button>
        <Link
          href="/projects"
          style={{
            background: 'transparent',
            color: 'var(--text)',
            border: '1px solid rgba(var(--ink-rgb),.16)',
            fontWeight: 600,
            fontSize: 14,
            padding: '10px 20px',
            borderRadius: 12,
            textDecoration: 'none',
          }}
        >
          الصفحة الرئيسية
        </Link>
      </div>
    </main>
  );
}
