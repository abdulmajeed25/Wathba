'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatSarFromHalalas } from '@/lib/i18n/format';

/**
 * Backer roster (Creator-CC / CC-02) + CSV export (CC-03) — Kickstarter
 * "Backer Report" parity. RTL table, sticky filter bar, 4 states, per-pledge
 * fulfillment control + bulk-by-tier, and PDPL-scoped CSV export.
 *
 * READ-ONLY on money: pledge (payment) status is a badge only; the sole
 * mutation here is `rewardStatus` — pure fulfillment bookkeeping.
 */

interface RosterRow {
  pledgeId: string;
  backerNo: number;
  backerName: string;
  /** STAKES/S-11 F-18 (C10) — links the roster name to /u/[handle]. */
  backerHandle: string | null;
  tierId: string;
  tierTitleAr: string;
  requiresShipping: boolean;
  addOns: Array<{ titleAr: string; qty: number }>;
  totalHalalas: number;
  status: string; // money status — read-only
  rewardStatus: 'PENDING' | 'IN_PROGRESS' | 'SENT';
  pledgedAt: string;
}

interface TierLite {
  id: string;
  titleAr: string;
}

const PLEDGE_STATUS: Record<string, { ar: string; fg: string; bg: string }> = {
  HELD: { ar: 'محجوز', fg: '#a96400', bg: 'rgba(245,158,11,0.12)' },
  CAPTURED: { ar: 'محصّل', fg: '#05a661', bg: 'rgba(5,166,97,0.10)' },
  REFUNDED: { ar: 'مُسترَد', fg: '#ef4444', bg: 'rgba(239,68,68,0.10)' },
  FAILED: { ar: 'فشل', fg: '#ef4444', bg: 'rgba(239,68,68,0.10)' },
  DISPUTED: { ar: 'متنازع عليه', fg: '#a96400', bg: 'rgba(245,158,11,0.12)' },
};

const REWARD_STATUS: Array<{ v: RosterRow['rewardStatus']; ar: string }> = [
  { v: 'PENDING', ar: 'بانتظار التجهيز' },
  { v: 'IN_PROGRESS', ar: 'قيد التجهيز' },
  { v: 'SENT', ar: 'تم الإرسال' },
];

const FULFILLMENT_STATES = new Set(['FUNDED', 'IN_PRODUCTION', 'DELIVERED']);

export function WathbaDashboardBackers({
  projectId,
  projectStatus,
  tiers,
}: {
  projectId: string;
  projectStatus: string;
  tiers: TierLite[];
}): React.ReactElement {
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'empty' | 'ok'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);

  // filters
  const [status, setStatus] = useState('');
  const [rewardStatus, setRewardStatus] = useState('');
  const [tierId, setTierId] = useState('');
  const [shippingOnly, setShippingOnly] = useState(false);
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 350);

  // bulk
  const [bulkTier, setBulkTier] = useState('');
  const [bulkStatus, setBulkStatus] = useState<RosterRow['rewardStatus']>('IN_PROGRESS');
  const [bulkBusy, setBulkBusy] = useState(false);

  const canFulfilmentExport = FULFILLMENT_STATES.has(projectStatus);

  const queryString = useCallback(
    (extra?: Record<string, string>): string => {
      const p = new URLSearchParams();
      if (status) p.set('status', status);
      if (rewardStatus) p.set('rewardStatus', rewardStatus);
      if (tierId) p.set('tierId', tierId);
      if (shippingOnly) p.set('shippingRequired', 'true');
      if (debounced.trim()) p.set('search', debounced.trim());
      for (const [k, v] of Object.entries(extra ?? {})) p.set(k, v);
      return p.toString();
    },
    [status, rewardStatus, tierId, shippingOnly, debounced],
  );

  const load = useCallback(async (): Promise<void> => {
    setState('loading');
    try {
      const res = await fetch(`/api/backers/${projectId}?${queryString({ take: '40' })}`);
      if (!res.ok) {
        setState('error');
        return;
      }
      const data = (await res.json()) as {
        items: RosterRow[];
        nextCursor: string | null;
        total: number;
      };
      setRows(data.items);
      setTotal(data.total);
      setNextCursor(data.nextCursor);
      setState(data.total === 0 ? 'empty' : 'ok');
    } catch {
      setState('error');
    }
  }, [projectId, queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async (): Promise<void> => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/backers/${projectId}?${queryString({ take: '40', cursor: nextCursor })}`);
      if (res.ok) {
        const data = (await res.json()) as { items: RosterRow[]; nextCursor: string | null };
        setRows((prev) => [...prev, ...data.items]);
        setNextCursor(data.nextCursor);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const setRowReward = async (pledgeId: string, value: RosterRow['rewardStatus']): Promise<void> => {
    const snapshot = rows;
    setRows((prev) => prev.map((r) => (r.pledgeId === pledgeId ? { ...r, rewardStatus: value } : r)));
    try {
      const res = await fetch(`/api/backers/${projectId}/${pledgeId}/reward-status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rewardStatus: value }),
      });
      if (!res.ok) setRows(snapshot);
    } catch {
      setRows(snapshot);
    }
  };

  const applyBulk = async (): Promise<void> => {
    setBulkBusy(true);
    try {
      const res = await fetch(`/api/backers/${projectId}/reward-status/bulk`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rewardStatus: bulkStatus, ...(bulkTier ? { tierId: bulkTier } : {}) }),
      });
      if (res.ok) await load();
    } finally {
      setBulkBusy(false);
    }
  };

  const hasFilters = Boolean(status || rewardStatus || tierId || shippingOnly || debounced.trim());

  return (
    <>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 6 }}>الداعمون</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary, #3b4942)', margin: 0 }}>
          سِجل الداعمين وحالة تسليم مكافآتهم. حالة الدفع للعرض فقط — التحويلات والاسترداد يديرها النظام.
        </p>
      </header>

      {/* sticky filter + export bar */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          background: 'var(--bg-base, #f4f6f1)',
          paddingBottom: 12,
          marginBottom: 12,
          borderBottom: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
        }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالاسم أو رقم الداعم (#)"
          aria-label="بحث في الداعمين"
          style={inputStyle(200)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="تصفية بحالة الدفع" style={inputStyle(150)}>
          <option value="">كل حالات الدفع</option>
          {Object.entries(PLEDGE_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.ar}</option>
          ))}
        </select>
        <select value={rewardStatus} onChange={(e) => setRewardStatus(e.target.value)} aria-label="تصفية بحالة التسليم" style={inputStyle(150)}>
          <option value="">كل حالات التسليم</option>
          {REWARD_STATUS.map((r) => (
            <option key={r.v} value={r.v}>{r.ar}</option>
          ))}
        </select>
        <select value={tierId} onChange={(e) => setTierId(e.target.value)} aria-label="تصفية بالمكافأة" style={inputStyle(160)}>
          <option value="">كل المكافآت</option>
          {tiers.map((t) => (
            <option key={t.id} value={t.id}>{t.titleAr}</option>
          ))}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary, #3b4942)', cursor: 'pointer' }}>
          <input type="checkbox" checked={shippingOnly} onChange={(e) => setShippingOnly(e.target.checked)} />
          يتطلب شحناً فقط
        </label>
        {hasFilters && (
          <button
            type="button"
            onClick={() => { setStatus(''); setRewardStatus(''); setTierId(''); setShippingOnly(false); setSearch(''); }}
            style={{ ...ghostBtn, fontSize: 12.5 }}
          >
            مسح التصفية
          </button>
        )}
        <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 8 }}>
          <a href={`/api/backers/${projectId}/export?${queryString({ level: 'summary' })}`} style={exportBtn} download>
            ⬇︎ تصدير CSV
          </a>
          <a
            href={canFulfilmentExport ? `/api/backers/${projectId}/export?${queryString({ level: 'fulfillment' })}` : undefined}
            aria-disabled={!canFulfilmentExport}
            title={canFulfilmentExport ? 'يشمل عناوين الشحن' : 'متاح بعد اكتمال التمويل فقط'}
            style={{ ...exportBtn, opacity: canFulfilmentExport ? 1 : 0.45, pointerEvents: canFulfilmentExport ? 'auto' : 'none' }}
            download
          >
            ⬇︎ تصدير الشحن
          </a>
        </div>
      </div>

      {/* bulk bar */}
      {state === 'ok' && (
        <div
          style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10,
            background: 'var(--bg-elevated, #fff)', border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
            borderRadius: 12, padding: '10px 14px', marginBottom: 14,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700 }}>تحديث جماعي لحالة التسليم:</span>
          <select value={bulkTier} onChange={(e) => setBulkTier(e.target.value)} aria-label="نطاق المكافأة للتحديث الجماعي" style={inputStyle(150)}>
            <option value="">كل الداعمين</option>
            {tiers.map((t) => (
              <option key={t.id} value={t.id}>{t.titleAr}</option>
            ))}
          </select>
          <span style={{ fontSize: 13, color: 'var(--text-tertiary, #5d6b62)' }}>←</span>
          <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as RosterRow['rewardStatus'])} aria-label="الحالة الجديدة" style={inputStyle(150)}>
            {REWARD_STATUS.map((r) => (
              <option key={r.v} value={r.v}>{r.ar}</option>
            ))}
          </select>
          <button type="button" onClick={() => void applyBulk()} disabled={bulkBusy} style={{ ...primaryBtn, opacity: bulkBusy ? 0.6 : 1 }}>
            {bulkBusy ? 'جارٍ التطبيق…' : 'تطبيق'}
          </button>
          <span style={{ marginInlineStart: 'auto', fontSize: 12.5, color: 'var(--text-tertiary, #5d6b62)' }}>
            {total} داعم
          </span>
        </div>
      )}

      {state === 'loading' && <RosterSkeleton />}
      {state === 'error' && (
        <StateCard tone="error">
          تعذّر تحميل قائمة الداعمين.{' '}
          <button type="button" onClick={() => void load()} style={{ ...ghostBtn, fontSize: 13 }}>إعادة المحاولة</button>
        </StateCard>
      )}
      {state === 'empty' && (
        <StateCard tone="empty">
          {hasFilters ? 'لا نتائج مطابقة للتصفية.' : (
            <>
              لا يوجد داعمون بعد. شارك رابط حملتك لتبدأ باستقبال الدعم:
              <div style={{ marginTop: 10 }}>
                <a href={`/projects/${projectId}`} style={{ ...primaryBtn, textDecoration: 'none', display: 'inline-block' }}>
                  عرض صفحة الحملة ←
                </a>
              </div>
            </>
          )}
        </StateCard>
      )}

      {state === 'ok' && (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))', borderRadius: 12, background: 'var(--bg-elevated, #fff)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 720 }}>
            <thead>
              <tr style={{ textAlign: 'right', color: 'var(--text-tertiary, #5d6b62)', fontSize: 12 }}>
                <Th>#</Th><Th>الداعم</Th><Th>المكافأة</Th><Th>الإضافات</Th><Th>المبلغ</Th><Th>حالة الدفع</Th><Th>حالة التسليم</Th><Th>التاريخ</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const ps = PLEDGE_STATUS[r.status] ?? { ar: r.status, fg: '#5d6b62', bg: 'rgba(0,0,0,0.05)' };
                return (
                  <tr key={r.pledgeId} style={{ borderTop: '1px solid var(--border-subtle, rgba(18,33,26,0.06))' }}>
                    <Td><span style={{ fontWeight: 700 }}>#{r.backerNo}</span></Td>
                    <Td>
                      {r.backerHandle ? (
                        <Link
                          href={`/u/${encodeURIComponent(r.backerHandle)}`}
                          style={{ color: 'var(--accent-ink)', fontWeight: 600, textDecoration: 'none' }}
                        >
                          {r.backerName}
                        </Link>
                      ) : (
                        r.backerName
                      )}
                    </Td>
                    <Td>
                      {r.tierTitleAr}
                      {r.requiresShipping && <span title="يتطلب شحناً" style={{ marginInlineStart: 6 }}>📦</span>}
                    </Td>
                    <Td>{r.addOns.length ? r.addOns.map((a) => `${a.titleAr}×${a.qty}`).join('، ') : '—'}</Td>
                    <Td><span style={{ fontWeight: 600 }}>{formatSarFromHalalas('ar', r.totalHalalas)}</span></Td>
                    <Td>
                      <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 20, color: ps.fg, background: ps.bg }}>
                        {ps.ar}
                      </span>
                    </Td>
                    <Td>
                      <select
                        value={r.rewardStatus}
                        onChange={(e) => void setRowReward(r.pledgeId, e.target.value as RosterRow['rewardStatus'])}
                        aria-label={`حالة تسليم الداعم رقم ${r.backerNo}`}
                        style={{ ...inputStyle(130), padding: '5px 8px', fontSize: 12.5 }}
                      >
                        {REWARD_STATUS.map((s) => (
                          <option key={s.v} value={s.v}>{s.ar}</option>
                        ))}
                      </select>
                    </Td>
                    <Td><span style={{ color: 'var(--text-tertiary, #5d6b62)' }}>{formatDateAr(r.pledgedAt)}</span></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {nextCursor && (
            <div style={{ padding: 12, textAlign: 'center', borderTop: '1px solid var(--border-subtle, rgba(18,33,26,0.06))' }}>
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

/* ---- small building blocks ------------------------------------------------ */

function Th({ children }: { children: React.ReactNode }): React.ReactElement {
  return <th style={{ padding: '12px 14px', fontWeight: 600, whiteSpace: 'nowrap' }}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }): React.ReactElement {
  return <td style={{ padding: '11px 14px', verticalAlign: 'middle' }}>{children}</td>;
}

function StateCard({ tone, children }: { tone: 'error' | 'empty'; children: React.ReactNode }): React.ReactElement {
  return (
    <div
      style={{
        padding: 24, borderRadius: 12, textAlign: 'center', fontSize: 14,
        background: 'var(--bg-elevated, #fff)',
        border: `1px dashed ${tone === 'error' ? 'rgba(239,68,68,0.4)' : 'var(--border-strong, rgba(18,33,26,0.16))'}`,
        color: tone === 'error' ? '#ef4444' : 'var(--text-secondary, #3b4942)',
      }}
    >
      {children}
    </div>
  );
}

function RosterSkeleton(): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ height: 46, borderRadius: 10, background: 'linear-gradient(90deg, rgba(0,0,0,0.04), rgba(0,0,0,0.07), rgba(0,0,0,0.04))' }} />
      ))}
    </div>
  );
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  const ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (ref.current) clearTimeout(ref.current);
    ref.current = setTimeout(() => setV(value), ms);
    return () => { if (ref.current) clearTimeout(ref.current); };
  }, [value, ms]);
  return v;
}

function formatDateAr(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

const inputStyle = (w: number): React.CSSProperties => ({
  minWidth: w, background: 'var(--bg-elevated, #fff)', border: '1px solid var(--border-subtle, rgba(18,33,26,0.14))',
  borderRadius: 10, padding: '8px 10px', fontSize: 13, color: 'var(--text-primary, #16201b)', fontFamily: 'inherit',
});
const ghostBtn: React.CSSProperties = {
  cursor: 'pointer', background: 'transparent', border: '1px solid var(--border-subtle, rgba(18,33,26,0.16))',
  color: 'var(--text-primary, #16201b)', fontWeight: 600, padding: '8px 16px', borderRadius: 10, fontFamily: 'inherit', fontSize: 13,
};
const primaryBtn: React.CSSProperties = {
  cursor: 'pointer', background: 'var(--brand-primary, #05a661)', color: '#fff', border: 'none',
  fontWeight: 700, padding: '8px 18px', borderRadius: 10, fontFamily: 'inherit', fontSize: 13,
};
const exportBtn: React.CSSProperties = {
  cursor: 'pointer', background: 'rgba(5,166,97,0.08)', color: 'var(--brand-primary, #05a661)',
  border: '1px solid rgba(5,166,97,0.4)', fontWeight: 700, padding: '8px 14px', borderRadius: 10,
  fontFamily: 'inherit', fontSize: 12.5, textDecoration: 'none',
};
