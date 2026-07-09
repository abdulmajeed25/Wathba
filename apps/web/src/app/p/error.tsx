'use client';

/** STAKES/S-13 (G2) — section error boundary for /p/*. */
export default function SectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main dir="rtl" style={{ minHeight: '60dvh', display: 'grid', placeItems: 'center', padding: 26, textAlign: 'center' }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>حدث خطأ غير متوقع</h1>
        <p style={{ fontSize: 14, color: '#667085', maxWidth: 420, margin: '0 auto 8px', lineHeight: 1.7 }}>
          تعذّر عرض هذا القسم. جرّب التحديث — وإن استمرت المشكلة تواصل مع الدعم.
        </p>
        {error.digest && (
          <p style={{ fontSize: 11.5, color: '#98a2b3', marginBottom: 18, direction: 'ltr' }}>
            ref: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          style={{
            background: 'linear-gradient(135deg, #05a661, #0bd47f)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            padding: '12px 24px',
            borderRadius: 12,
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          إعادة المحاولة
        </button>
      </div>
    </main>
  );
}
