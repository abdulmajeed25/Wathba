'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Creator self-audit timeline (Creator-CC / CC-18). Reads the append-only audit
 * trail scoped to one project. Actor chips distinguish أنت (creator) / الإدارة
 * (admin) / النظام (system-executed, e.g. cancel refunds). A cancel row expands
 * to show how many refunds the system executed as a consequence.
 */

interface AuditRow {
  id: string;
  action: string;
  actorType: 'you' | 'admin' | 'system';
  entity: string;
  entityId: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
  linkedRefundCount: number | null;
}

const ACTION_AR: Record<string, string> = {
  'creator.project.submit': 'إرسال المشروع للمراجعة',
  'creator.project.cancel': 'إلغاء الحملة',
  'creator.project.delete-draft': 'حذف المسودّة',
  'creator.reward-status.bulk': 'تحديث جماعي لحالة التسليم',
  'creator.backers.export': 'تصدير قائمة الداعمين',
  'creator.milestone.evidence': 'رفع إثبات مرحلة',
  'system.refund.cancel': 'استرداد آلي بعد الإلغاء',
  'admin.review.approve': 'اعتماد الحملة (الإدارة)',
  'admin.review.reject': 'طلب تعديلات (الإدارة)',
  'admin.settle': 'تسوية مالية (الإدارة)',
  'admin.disburse': 'صرف دفعات (الإدارة)',
  'admin.platform-partner': 'تحديث شراكة المنصّة',
};

const ACTOR: Record<AuditRow['actorType'], { ar: string; fg: string; bg: string }> = {
  you: { ar: 'أنت', fg: '#047649', bg: 'rgba(5,166,97,0.10)' },
  admin: { ar: 'الإدارة', fg: '#9a5a06', bg: 'rgba(245,158,11,0.12)' },
  system: { ar: 'النظام', fg: '#4f46e5', bg: 'rgba(99,102,241,0.12)' },
};

const FILTERS: Array<{ v: string; ar: string }> = [
  { v: '', ar: 'كل الأحداث' },
  { v: 'creator.project.cancel', ar: 'الإلغاء' },
  { v: 'creator.project.submit', ar: 'الإرسال للمراجعة' },
  { v: 'creator.backers.export', ar: 'تصدير الداعمين' },
  { v: 'creator.reward-status.bulk', ar: 'تحديث التسليم' },
  { v: 'creator.milestone.evidence', ar: 'إثبات المراحل' },
];

export function WathbaDashboardAuditTimeline({ projectId }: { projectId: string }): React.ReactElement {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'empty' | 'ok'>('loading');
  const [action, setAction] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loadingMore, setLoadingMore] = useState(false);

  const qs = useCallback(
    (extra?: Record<string, string>): string => {
      const p = new URLSearchParams();
      if (action) p.set('action', action);
      for (const [k, v] of Object.entries(extra ?? {})) p.set(k, v);
      return p.toString();
    },
    [action],
  );

  const load = useCallback(async (): Promise<void> => {
    setState('loading');
    try {
      const res = await fetch(`/api/audit/${projectId}?${qs({ take: '25' })}`);
      if (!res.ok) {
        setState('error');
        return;
      }
      const data = (await res.json()) as { items: AuditRow[]; nextCursor: string | null };
      setRows(data.items);
      setNextCursor(data.nextCursor);
      setState(data.items.length === 0 ? 'empty' : 'ok');
    } catch {
      setState('error');
    }
  }, [projectId, qs]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async (): Promise<void> => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/audit/${projectId}?${qs({ take: '25', cursor: nextCursor })}`);
      if (res.ok) {
        const data = (await res.json()) as { items: AuditRow[]; nextCursor: string | null };
        setRows((prev) => [...prev, ...data.items]);
        setNextCursor(data.nextCursor);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 6 }}>سجل النشاط</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary, #3b4942)', margin: 0 }}>
          سجل غير قابل للتعديل لكل إجراء على حملتك — قراراتك، مراجعات الإدارة، والإجراءات النظامية.
        </p>
      </header>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {FILTERS.map((f) => (
          <button
            key={f.v}
            type="button"
            onClick={() => setAction(f.v)}
            style={{
              fontSize: 12.5, fontWeight: 600, padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
              fontFamily: 'inherit',
              border: `1px solid ${action === f.v ? 'rgba(5,166,97,0.5)' : 'rgba(18,33,26,0.14)'}`,
              background: action === f.v ? 'rgba(5,166,97,0.08)' : 'transparent',
              color: action === f.v ? 'var(--brand-ink, #047649)' : 'var(--text-secondary, #3b4942)',
            }}
          >
            {f.ar}
          </button>
        ))}
      </div>

      {state === 'loading' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ height: 52, borderRadius: 10, background: 'linear-gradient(90deg, rgba(0,0,0,0.04), rgba(0,0,0,0.07), rgba(0,0,0,0.04))' }} />
          ))}
        </div>
      )}
      {state === 'error' && (
        <Card tone="error">
          تعذّر تحميل السجل.{' '}
          <button type="button" onClick={() => void load()} style={linkBtn}>إعادة المحاولة</button>
        </Card>
      )}
      {state === 'empty' && <Card tone="empty">لا توجد أحداث مطابقة بعد.</Card>}

      {state === 'ok' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' }}>
          {rows.map((r, idx) => {
            const actor = ACTOR[r.actorType];
            const label = ACTION_AR[r.action] ?? r.action;
            const isCancel = r.action === 'creator.project.cancel' && r.linkedRefundCount != null;
            const open = expanded[r.id];
            return (
              <div key={r.id} style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
                {/* rail */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 14 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: actor.fg, marginTop: 16, flexShrink: 0 }} />
                  {idx < rows.length - 1 && <span style={{ width: 2, flex: 1, background: 'rgba(18,33,26,0.10)' }} />}
                </div>
                <div style={{ flex: 1, paddingBottom: 14 }}>
                  <div
                    style={{
                      background: 'var(--bg-elevated, #fff)',
                      border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
                      borderRadius: 12, padding: '11px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, color: actor.fg, background: actor.bg }}>
                        {actor.ar}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
                      <span title={absoluteAr(r.createdAt)} style={{ marginInlineStart: 'auto', fontSize: 11.5, color: 'var(--text-tertiary, #5d6b62)' }}>
                        {relativeAr(r.createdAt)}
                      </span>
                    </div>
                    {isCancel && (
                      <button
                        type="button"
                        onClick={() => setExpanded((p) => ({ ...p, [r.id]: !p[r.id] }))}
                        style={{ ...linkBtn, marginTop: 6, fontSize: 12.5 }}
                      >
                        {open ? 'إخفاء التفاصيل' : `عرض أثر الإلغاء (${r.linkedRefundCount} استرداد)`}
                      </button>
                    )}
                    {isCancel && open && (
                      <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--text-secondary, #3b4942)', lineHeight: 1.7 }}>
                        نفّذ النظام استرداد المبالغ إلى <b>{r.linkedRefundCount}</b> داعم كنتيجة تلقائية لهذا الإلغاء.
                        {typeof r.detail.backersCount !== 'undefined' && (
                          <> عدد الداعمين وقت الإلغاء: {String(r.detail.backersCount)}.</>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {nextCursor && (
            <div style={{ textAlign: 'center', paddingTop: 6 }}>
              <button type="button" onClick={() => void loadMore()} disabled={loadingMore} style={ghostBtn}>
                {loadingMore ? 'جارٍ التحميل…' : 'تحميل المزيد'}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function Card({ tone, children }: { tone: 'error' | 'empty'; children: React.ReactNode }): React.ReactElement {
  return (
    <div
      style={{
        padding: 24, borderRadius: 12, textAlign: 'center', fontSize: 14,
        background: 'var(--bg-elevated, #fff)',
        border: `1px dashed ${tone === 'error' ? 'rgba(239,68,68,0.4)' : 'var(--border-strong, rgba(18,33,26,0.16))'}`,
        color: tone === 'error' ? '#b91c1c' : 'var(--text-secondary, #3b4942)',
      }}
    >
      {children}
    </div>
  );
}

function relativeAr(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const s = Math.max(0, Math.round((nowMs() - then) / 1000));
    if (s < 60) return 'قبل لحظات';
    const m = Math.round(s / 60);
    if (m < 60) return `قبل ${m} دقيقة`;
    const h = Math.round(m / 60);
    if (h < 24) return `قبل ${h} ساعة`;
    const d = Math.round(h / 24);
    if (d < 30) return `قبل ${d} يوم`;
    return absoluteAr(iso);
  } catch {
    return absoluteAr(iso);
  }
}

// Wrapped so the value is read at call time (client render), never at module load.
function nowMs(): number {
  return Date.now();
}

function absoluteAr(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

const linkBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
  color: 'var(--brand-ink, #047649)', fontWeight: 600, fontFamily: 'inherit', fontSize: 13,
};
const ghostBtn: React.CSSProperties = {
  cursor: 'pointer', background: 'transparent', border: '1px solid var(--border-subtle, rgba(18,33,26,0.16))',
  color: 'var(--text-primary, #16201b)', fontWeight: 600, padding: '8px 16px', borderRadius: 10, fontFamily: 'inherit', fontSize: 13,
};
