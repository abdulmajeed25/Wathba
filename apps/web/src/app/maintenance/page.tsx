import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'صيانة مجدولة · وثبة',
  robots: { index: false, follow: false },
};

/**
 * STAKES/S-13 (G5) — the maintenance surface. Served (rewritten, 503) for
 * every path while MAINTENANCE_MODE=1; standalone styling so it never
 * depends on the app shell being healthy.
 */
export default function MaintenancePage() {
  return (
    <main
      dir="rtl"
      style={{
        minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24,
        background: '#f4f6f1', color: '#16201b',
        fontFamily: "'IBM Plex Sans Arabic', 'Segoe UI', system-ui, sans-serif",
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: 460 }}>
        <div
          aria-hidden
          style={{
            width: 84, height: 84, borderRadius: 24, margin: '0 auto 22px',
            background: 'linear-gradient(135deg,#05c074,#03a98e)', display: 'grid', placeItems: 'center',
            fontSize: 40, color: '#fff',
          }}
        >
          🛠️
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 10 }}>صيانة مجدولة</h1>
        <p style={{ fontSize: 15, lineHeight: 1.8, color: '#45524a' }}>
          نجري تحسينات على وثبة الآن وسنعود خلال وقت قصير.
          تعهّداتك وحملاتك بأمان — لا حاجة لأي إجراء منك.
        </p>
        <p style={{ fontSize: 12.5, color: '#6b776f', marginTop: 14 }}>
          للاستفسارات العاجلة: <span dir="ltr">support@wathba.sa</span>
        </p>
      </div>
    </main>
  );
}
