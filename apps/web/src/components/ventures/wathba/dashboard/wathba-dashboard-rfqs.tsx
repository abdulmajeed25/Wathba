'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { ApiBidPublic, ApiRfqDetail, ApiRfqPublic } from '@/lib/api/wathba';
import { Icon, Num } from '../wathba-icons';
import { formatSarFromHalalas } from '@/lib/i18n/format';

/**
 * Creator reverse-auction manager (Sprint 3 / P0-302).
 * Publish an RFQ → suppliers bid (sorted ascending server-side) → award one
 * bid; the API atomically marks the rest REJECTED and closes the RFQ.
 */

const STATUS_TONE: Record<string, { label: string; color: string; bg: string }> = {
  OPEN:    { label: 'مفتوح',  color: 'var(--pos)',    bg: 'rgba(52,211,153,.10)' },
  AWARDED: { label: 'مُرسى',   color: 'var(--accent)', bg: 'rgba(var(--accent-rgb),.10)' },
  CLOSED:  { label: 'مغلق',   color: 'var(--muted)',  bg: 'rgba(var(--ink-rgb),.06)' },
};

export function WathbaDashboardRfqs({
  projectId,
  initialRfqs,
}: {
  projectId: string;
  initialRfqs: ApiRfqPublic[] | null;
}) {
  const router = useRouter();
  const rfqs = initialRfqs ?? [];
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApiRfqDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // create form
  const [specsAr, setSpecsAr] = useState('');
  const [dueDate, setDueDate] = useState('');

  async function createRfq(): Promise<void> {
    setError(null);
    if (specsAr.trim().length < 40) {
      setError('المواصفات يجب أن تكون ٤٠ حرفاً على الأقل.');
      return;
    }
    if (!dueDate) {
      setError('حدد الموعد النهائي لاستقبال العروض.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/rfqs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId, specsAr: specsAr.trim(), dueDate }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { message?: string | string[] };
        setError(Array.isArray(j.message) ? j.message.join('، ') : (j.message ?? 'تعذّر النشر'));
        return;
      }
      setSpecsAr('');
      setDueDate('');
      router.refresh();
    } catch {
      setError('خطأ في الاتصال — أعد المحاولة.');
    } finally {
      setBusy(false);
    }
  }

  async function loadBids(rfqId: string): Promise<void> {
    if (openId === rfqId) {
      setOpenId(null);
      setDetail(null);
      return;
    }
    setOpenId(rfqId);
    setDetail(null);
    try {
      const res = await fetch(`/api/rfqs/${rfqId}/detail`);
      if (res.ok) setDetail((await res.json()) as ApiRfqDetail);
    } catch {
      /* detail row shows its own empty state */
    }
  }

  async function award(rfqId: string, bidId: string): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rfqs/${rfqId}/award/${bidId}`, { method: 'POST' });
      if (!res.ok) {
        const j = (await res.json()) as { message?: string };
        setError(j.message ?? 'تعذّر الإرساء');
        return;
      }
      setOpenId(null);
      setDetail(null);
      router.refresh();
    } catch {
      setError('خطأ في الاتصال — أعد المحاولة.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wathba-fade" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
          المزاد العكسي — طلبات التوريد
        </h2>
        <p style={{ fontSize: 13.5, color: 'var(--muted)', maxWidth: 640, lineHeight: 1.6 }}>
          انشر طلب توريد بمواصفات واضحة، وسيقدّم المورّدون عروضهم تنازلياً. عند
          الإرساء يُرفض باقي العروض تلقائياً ويُغلق الطلب.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            fontSize: 13,
            color: '#ef4444',
            background: 'rgba(239,68,68,.07)',
            border: '1px solid rgba(239,68,68,.25)',
            borderRadius: 11,
            padding: '12px 14px',
          }}
        >
          {error}
        </div>
      )}

      {/* create RFQ */}
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid rgba(var(--ink-rgb),.08)',
          borderRadius: 16,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700 }}>نشر طلب توريد جديد</div>
        <label style={{ fontSize: 13, color: 'var(--muted)' }}>
          المواصفات (٤٠ حرفاً على الأقل)
          <textarea
            value={specsAr}
            onChange={(e) => setSpecsAr(e.target.value)}
            rows={3}
            style={{
              width: '100%',
              marginTop: 6,
              background: 'rgba(var(--ink-rgb),.04)',
              border: '1px solid rgba(var(--ink-rgb),.12)',
              borderRadius: 11,
              padding: '10px 12px',
              color: 'var(--text)',
              fontSize: 13.5,
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
        </label>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>
            الموعد النهائي للعروض
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{
                display: 'block',
                marginTop: 6,
                background: 'rgba(var(--ink-rgb),.04)',
                border: '1px solid rgba(var(--ink-rgb),.12)',
                borderRadius: 11,
                padding: '10px 12px',
                color: 'var(--text)',
                fontSize: 13.5,
                fontFamily: 'inherit',
              }}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void createRfq()}
            style={{
              cursor: busy ? 'wait' : 'pointer',
              background: 'var(--grad)',
              color: 'var(--on-accent)',
              border: 'none',
              fontWeight: 700,
              fontSize: 14,
              padding: '11px 22px',
              borderRadius: 11,
              fontFamily: 'inherit',
              opacity: busy ? 0.6 : 1,
            }}
          >
            نشر الطلب
          </button>
        </div>
      </div>

      {/* RFQ list */}
      {rfqs.length === 0 ? (
        <div
          style={{
            border: '1px dashed rgba(var(--ink-rgb),.15)',
            borderRadius: 14,
            padding: 28,
            textAlign: 'center',
            color: 'var(--muted)',
            fontSize: 14,
          }}
        >
          لا توجد طلبات توريد بعد — انشر أول طلب أعلاه.
        </div>
      ) : (
        rfqs.map((r) => {
          const tone = STATUS_TONE[r.status] ?? STATUS_TONE.OPEN!;
          const isOpen = openId === r.id;
          return (
            <div
              key={r.id}
              style={{
                background: 'var(--card)',
                border: '1px solid rgba(var(--ink-rgb),.08)',
                borderRadius: 16,
                padding: 18,
              }}
            >
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-soft)' }}>
                    {r.specsAr.length > 160 ? `${r.specsAr.slice(0, 160)}…` : r.specsAr}
                  </p>
                  <Num style={{ fontSize: 11.5, color: 'var(--muted2)' }}>
                    آخر موعد: {r.dueDate.slice(0, 10)} · {r.bidsCount} عرض
                  </Num>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '6px 14px',
                    borderRadius: 20,
                    background: tone.bg,
                    color: tone.color,
                  }}
                >
                  {tone.label}
                </span>
                <button
                  type="button"
                  onClick={() => void loadBids(r.id)}
                  style={{
                    cursor: 'pointer',
                    background: 'transparent',
                    border: '1px solid rgba(var(--ink-rgb),.16)',
                    color: 'var(--text)',
                    fontWeight: 600,
                    fontSize: 12.5,
                    padding: '8px 16px',
                    borderRadius: 10,
                    fontFamily: 'inherit',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Icon name={isOpen ? 'expand_less' : 'gavel'} size={15} />
                  {isOpen ? 'إخفاء العروض' : 'عرض العروض'}
                </button>
              </div>

              {isOpen && (
                <div style={{ marginTop: 14, borderTop: '1px solid rgba(var(--ink-rgb),.07)', paddingTop: 14 }}>
                  {!detail ? (
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>جارٍ تحميل العروض…</div>
                  ) : !detail.bids || detail.bids.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>لا عروض على هذا الطلب بعد.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                      {detail.bids.map((b: ApiBidPublic, idx: number) => (
                        <div
                          key={b.id}
                          style={{
                            display: 'flex',
                            gap: 14,
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            background: idx === 0 ? 'rgba(52,211,153,.05)' : 'rgba(var(--ink-rgb),.025)',
                            border: `1px solid ${idx === 0 ? 'rgba(52,211,153,.25)' : 'rgba(var(--ink-rgb),.07)'}`,
                            borderRadius: 12,
                            padding: '12px 14px',
                          }}
                        >
                          <Num style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', minWidth: 110 }}>
                            {formatSarFromHalalas('ar', b.amountHalalas)}
                          </Num>
                          <Num style={{ fontSize: 12.5, color: 'var(--muted)' }}>{b.leadTimeDays} يوم</Num>
                          <span style={{ flex: 1, fontSize: 12, color: 'var(--muted2)', minWidth: 180 }}>
                            {b.specComplianceNote ?? ''}
                          </span>
                          {r.status === 'OPEN' ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void award(r.id, b.id)}
                              style={{
                                cursor: busy ? 'wait' : 'pointer',
                                background: 'var(--grad)',
                                color: 'var(--on-accent)',
                                border: 'none',
                                fontWeight: 700,
                                fontSize: 12.5,
                                padding: '9px 18px',
                                borderRadius: 10,
                                fontFamily: 'inherit',
                                opacity: busy ? 0.6 : 1,
                              }}
                            >
                              إرساء على هذا العرض
                            </button>
                          ) : (
                            <span style={{ fontSize: 12, fontWeight: 700, color: b.status === 'AWARDED' ? 'var(--accent)' : 'var(--muted2)' }}>
                              {b.status === 'AWARDED' ? '★ الفائز' : b.status === 'REJECTED' ? 'مرفوض' : b.status}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
