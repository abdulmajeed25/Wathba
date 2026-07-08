'use client';

/**
 * STAKES/Q2 — the ROOT error boundary (catches failures in the root layout
 * itself, where app/error.tsx can't reach). Must render its own <html> —
 * Arabic RTL like every other page (Q2: lang/dir on error pages too).
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center',
          background: '#f7faf8', color: '#16201b',
          fontFamily: "'Tajawal', 'IBM Plex Sans Arabic', system-ui, sans-serif",
        }}
      >
        <main style={{ textAlign: 'center', padding: 24, maxWidth: 460 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }} aria-hidden>⚠️</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 10px' }}>حدث خطأ غير متوقع</h1>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#3b4942', margin: '0 0 20px' }}>
            تعذّر عرض الصفحة. جرّب التحديث — وإن استمرت المشكلة تواصل مع
            support@wathba.sa.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              background: 'linear-gradient(135deg, #05a661, #0ea5e9)', color: '#fff',
              border: 'none', fontWeight: 700, fontSize: 14, padding: '12px 26px',
              borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            إعادة المحاولة
          </button>
        </main>
      </body>
    </html>
  );
}
