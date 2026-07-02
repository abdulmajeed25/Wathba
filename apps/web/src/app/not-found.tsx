import Link from 'next/link';

/** Global Arabic 404 (Sprint 3 / P0-203). */
export default function NotFound() {
  return (
    <main
      dir="rtl"
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 26,
        textAlign: 'center',
        fontFamily: '"IBM Plex Sans Arabic", system-ui, sans-serif',
      }}
    >
      <div>
        <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: '-2px', marginBottom: 8 }}>
          ٤٠٤
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 10 }}>
          الصفحة غير موجودة
        </h1>
        <p style={{ fontSize: 15, color: '#667085', maxWidth: 420, margin: '0 auto 24px', lineHeight: 1.7 }}>
          الرابط الذي تبحث عنه غير موجود أو تم نقله. جرّب العودة للرئيسية أو
          استكشف المشاريع الحية.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Link
            href="/projects"
            style={{
              background: 'linear-gradient(135deg, #05a661, #0bd47f)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              padding: '12px 22px',
              borderRadius: 12,
              textDecoration: 'none',
            }}
          >
            الرئيسية
          </Link>
          <Link
            href="/projects/discover"
            style={{
              border: '1px solid #d0d5dd',
              color: '#344054',
              fontWeight: 600,
              fontSize: 14,
              padding: '12px 22px',
              borderRadius: 12,
              textDecoration: 'none',
            }}
          >
            استكشف المشاريع
          </Link>
        </div>
      </div>
    </main>
  );
}
