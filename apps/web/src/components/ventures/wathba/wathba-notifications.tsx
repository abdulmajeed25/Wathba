import { EmptyState } from './wathba-states';
import { Icon, Num } from './wathba-icons';

/**
 * Notifications center — in-app inbox. The Wathba backend's notifications
 * module exists (apps/api/src/notifications/*) but isn't yet wired to the web
 * routes. This screen consumes a stub fixture today; wiring to
 * /v1/notifications/me lands in the same pass as the role-aware bearer flow.
 */

interface InboxItem {
  id: string;
  kind: 'PLEDGE_RECEIVED' | 'PROJECT_FUNDED' | 'MILESTONE_RELEASED' | 'PROJECT_UPDATE' | 'NAFATH_VERIFIED';
  titleAr: string;
  bodyAr: string;
  date: string;
  read: boolean;
}

const SAMPLE: InboxItem[] = [
  {
    id: 'n1', kind: 'MILESTONE_RELEASED',
    titleAr: 'تم صرف مرحلة جديدة — سِرب',
    bodyAr: 'صُرفت المرحلة الثانية ($240K) لمشروع سِرب بعد رفع شهادة CE والاجتياز.',
    date: 'قبل ساعة', read: false,
  },
  {
    id: 'n2', kind: 'PROJECT_FUNDED',
    titleAr: 'نجحت حكايا! 🎉',
    bodyAr: 'وصل مشروع حكايا — لعبة الطاولة العربية إلى ١٠٧٪ من الهدف. شكراً لدعمك.',
    date: 'قبل ٣ ساعات', read: false,
  },
  {
    id: 'n3', kind: 'PROJECT_UPDATE',
    titleAr: 'تحديث من فريق بستان',
    bodyAr: 'انتهينا من اختبارات النسيج المعاد تدويره. النموذج النهائي جاهز للإنتاج.',
    date: 'أمس', read: true,
  },
  {
    id: 'n4', kind: 'NAFATH_VERIFIED',
    titleAr: 'تم تأكيد هويتك عبر نفاذ',
    bodyAr: 'يمكنك الآن إطلاق المشاريع وسحب المبالغ المستحقة.',
    date: 'قبل ٣ أيام', read: true,
  },
];

const ICON_FOR: Record<InboxItem['kind'], { icon: string; color: string; bg: string }> = {
  PLEDGE_RECEIVED:    { icon: 'favorite',         color: 'var(--accent)', bg: 'rgba(var(--accent-rgb),.10)' },
  PROJECT_FUNDED:     { icon: 'rocket_launch',    color: 'var(--pos)',    bg: 'rgba(52,211,153,.10)' },
  MILESTONE_RELEASED: { icon: 'flag',             color: 'var(--accent)', bg: 'rgba(var(--accent-rgb),.10)' },
  PROJECT_UPDATE:     { icon: 'campaign',         color: 'var(--blue)',   bg: 'rgba(var(--accent2-rgb),.12)' },
  NAFATH_VERIFIED:    { icon: 'verified_user',    color: 'var(--purple)', bg: 'rgba(var(--purple-rgb),.10)' },
};

export function WathbaNotifications({ items = SAMPLE }: { items?: InboxItem[] } = {}) {
  const unread = items.filter((i) => !i.read).length;

  return (
    <div className="wathba-fade">
      <section style={{ maxWidth: 820, margin: '0 auto', padding: '48px 26px 80px' }}>
        <Num style={{ display: 'block', fontSize: 12, letterSpacing: 2, color: 'var(--accent)', marginBottom: 8 }}>
          NOTIFICATIONS · صندوق الإشعارات
        </Num>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h1 style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-.8px' }}>الإشعارات</h1>
          {unread > 0 && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '5px 12px',
                borderRadius: 20,
                background: 'rgba(var(--accent-rgb),.10)',
                color: 'var(--accent)',
                border: '1px solid rgba(var(--accent-rgb),.30)',
              }}
            >
              {unread} غير مقروء
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon="notifications"
            title="لا توجد إشعارات بعد"
            body="ستظهر هنا تحديثات المشاريع التي دعمتها، مراحل الصرف، وحالة حسابك."
          />
        ) : (
          <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((n) => {
              const styling = ICON_FOR[n.kind];
              return (
                <article
                  key={n.id}
                  style={{
                    background: n.read ? 'var(--card)' : 'rgba(var(--accent-rgb),.04)',
                    border: `1px solid ${n.read ? 'rgba(var(--ink-rgb),.08)' : 'rgba(var(--accent-rgb),.18)'}`,
                    borderRadius: 14,
                    padding: 18,
                    display: 'flex',
                    gap: 14,
                    alignItems: 'flex-start',
                  }}
                >
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: 11,
                      background: styling.bg,
                      color: styling.color,
                      display: 'grid', placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon name={styling.icon} size={20} color={styling.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700 }}>{n.titleAr}</h3>
                      <Num style={{ fontSize: 11.5, color: 'var(--muted2)', flexShrink: 0 }}>
                        {n.date}
                      </Num>
                    </div>
                    <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6 }}>{n.bodyAr}</p>
                  </div>
                  {!n.read && (
                    <span
                      aria-hidden
                      style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: 'var(--accent)',
                        flexShrink: 0,
                        marginTop: 6,
                      }}
                    />
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
