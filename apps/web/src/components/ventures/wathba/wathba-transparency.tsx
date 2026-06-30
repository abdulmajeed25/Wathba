'use client';

import { useEffect, useState } from 'react';
import { Group } from '@visx/group';
import { scaleLinear } from '@visx/scale';
import { Bar } from '@visx/shape';

import { Icon, Num } from './wathba-icons';

/**
 * Public Transparency surface (Slice "Option-2" — Kickstarter-style rebuild).
 *
 * Replaces the previous static placeholder in wathba-campaign.tsx with the
 * real escrow + milestones view from the API. Same data the creator sees on
 * their dashboard Milestones manager, scoped to read-only public display.
 *
 *  - GET /api/public-transparency/:projectId → budget + spend timeline
 *  - GET /api/public-milestones/:projectId   → per-milestone status pills
 *  - visx stacked bar = released / approved / pending breakdown
 *
 * Falls back to an empty state on either API failure so the page never breaks.
 */

interface MilestoneRow {
  id: string;
  order: number;
  titleAr: string;
  evidenceRequired: string;
  evidenceUrl: string | null;
  releasePct: number;
  status: 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'RELEASED';
  releasedHalalas: number;
  submittedAt: string | null;
  approvedAt: string | null;
  releasedAt: string | null;
}

interface BudgetRow {
  milestoneId?: string;
  label: string;
  pct: number;
  amountHalalas: number;
  status?: string;
}

interface SpendRow {
  id: string;
  milestoneId: string | null;
  amountHalalas: number;
  descAr: string;
  date: string;
  proofUrl: string | null;
}

interface TransparencyResp {
  budget:
    | BudgetRow[]
    | { totalSpentHalalas: number; totalRaisedHalalas: number; rows: BudgetRow[] };
  timeline: SpendRow[];
}

const STATUS_TONE: Record<
  MilestoneRow['status'],
  { label: string; bg: string; color: string; border: string }
> = {
  PENDING: {
    label: 'قيد الانتظار',
    bg: 'rgba(var(--ink-rgb),.06)',
    color: 'var(--muted)',
    border: 'rgba(var(--ink-rgb),.18)',
  },
  SUBMITTED: {
    label: 'قيد المراجعة',
    bg: 'rgba(251,191,36,.10)',
    color: 'var(--gold, #b88700)',
    border: 'rgba(251,191,36,.32)',
  },
  APPROVED: {
    label: 'موافق · بانتظار الصرف',
    bg: 'rgba(99,102,241,.10)',
    color: 'var(--blue, #4f46e5)',
    border: 'rgba(99,102,241,.32)',
  },
  RELEASED: {
    label: 'تم الصرف',
    bg: 'rgba(52,211,153,.10)',
    color: 'var(--pos, #047857)',
    border: 'rgba(52,211,153,.32)',
  },
};

function halalasToSar(h: number): string {
  return (h / 100).toLocaleString('ar-SA', { maximumFractionDigits: 0 });
}

function formatDateAr(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function WathbaTransparency({
  projectId,
  raisedFmt,
}: {
  projectId: string;
  raisedFmt: string;
}): React.ReactElement {
  const [milestones, setMilestones] = useState<MilestoneRow[] | null>(null);
  const [transparency, setTransparency] = useState<TransparencyResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    Promise.all([
      fetch(`/api/public-milestones/${projectId}`)
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .catch(() => ({ items: [] })),
      fetch(`/api/public-transparency/${projectId}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([m, t]) => {
      if (cancel) return;
      setMilestones((m?.items as MilestoneRow[]) ?? []);
      setTransparency(t as TransparencyResp | null);
      setLoading(false);
    });
    return () => {
      cancel = true;
    };
  }, [projectId]);

  const rows: MilestoneRow[] = (milestones ?? []).slice().sort((a, b) => a.order - b.order);
  const budgetRows: BudgetRow[] = Array.isArray(transparency?.budget)
    ? (transparency!.budget as BudgetRow[])
    : (transparency?.budget?.rows ?? []);
  const timeline: SpendRow[] = transparency?.timeline ?? [];

  const empty = !loading && rows.length === 0 && budgetRows.length === 0 && timeline.length === 0;

  return (
    <div
      dir="rtl"
      style={{
        maxWidth: 980,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
        // Reserve space so the section never shrinks below the viewport mid
        // smooth-scroll — otherwise the page jumps when fetched data resolves.
        minHeight: 700,
      }}
    >
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Icon name="query_stats" size={22} color="var(--pos, #047857)" />
          <h2 style={{ fontSize: 24, fontWeight: 700 }}>لوحة الشفافية الحيّة</h2>
        </div>
        <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.65 }}>
          نوضّح بالضبط كيف يُنفَق كل ريال تدعمنا به. الأرقام تتحدّث تلقائياً مع كل
          خطوة في الحملة. إجمالي المُجمَّع حتى الآن:{' '}
          <Num style={{ fontWeight: 700, color: 'var(--accent)' }}>{raisedFmt}</Num>.
        </p>
      </header>

      {loading && <SkeletonBlock />}

      {empty && (
        <div
          style={{
            background: 'var(--card)',
            border: '1px dashed rgba(var(--ink-rgb),.16)',
            borderRadius: 16,
            padding: 36,
            textAlign: 'center',
            color: 'var(--muted)',
            fontSize: 14,
          }}
        >
          لم يحدّد المبدع المراحل والميزانية بعد — هذا الجزء يفعّل تلقائياً بعد تحديثها من
          لوحة المبدع.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <EscrowChart rows={rows} />
      )}

      {!loading && rows.length > 0 && (
        <section>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>المراحل ({rows.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {rows.map((m) => (
              <MilestoneCard key={m.id} m={m} />
            ))}
          </div>
        </section>
      )}

      {!loading && budgetRows.length > 0 && (
        <section>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>توزيع الميزانية</h3>
          <div
            style={{
              background: 'var(--card)',
              border: '1px solid rgba(var(--ink-rgb),.08)',
              borderRadius: 14,
              overflow: 'hidden',
            }}
          >
            {budgetRows.map((r, i) => (
              <div
                key={(r.milestoneId ?? '') + r.label + i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 16px',
                  borderBottom: '1px solid rgba(var(--ink-rgb),.05)',
                  fontSize: 13,
                }}
              >
                <span style={{ color: 'var(--text)' }}>{r.label}</span>
                <span style={{ display: 'inline-flex', gap: 14, color: 'var(--muted)' }}>
                  <Num>{halalasToSar(r.amountHalalas)} ر.س</Num>
                  <Num style={{ fontWeight: 700 }}>{r.pct}%</Num>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {!loading && timeline.length > 0 && (
        <section>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>سجلّ الصرف</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {timeline.map((s) => (
              <div
                key={s.id}
                style={{
                  background: 'var(--card)',
                  border: '1px solid rgba(var(--ink-rgb),.08)',
                  borderRadius: 12,
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 13,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{s.descAr}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>
                    {formatDateAr(s.date)}
                  </div>
                </div>
                <Num style={{ fontWeight: 700, color: 'var(--accent)' }}>
                  {halalasToSar(s.amountHalalas)} ر.س
                </Num>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function EscrowChart({ rows }: { rows: MilestoneRow[] }): React.ReactElement {
  const W = 720;
  const H = 28;
  const totalPct = rows.reduce((acc, r) => acc + r.releasePct, 0) || 100;
  const x = scaleLinear({ domain: [0, totalPct], range: [0, W] });
  let cursor = 0;
  return (
    <section>
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>تقدّم صرف الضمان</h3>
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid rgba(var(--ink-rgb),.08)',
          borderRadius: 16,
          padding: 22,
        }}
      >
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="تقدّم صرف الضمان">
          <Group>
            <Bar x={0} y={0} width={W} height={H} rx={9} fill="rgba(var(--ink-rgb),.06)" />
            {rows.map((r) => {
              const w = x(r.releasePct);
              const tone = STATUS_TONE[r.status];
              const fill =
                r.status === 'RELEASED'
                  ? 'rgba(52,211,153,.85)'
                  : r.status === 'APPROVED'
                    ? 'rgba(99,102,241,.85)'
                    : r.status === 'SUBMITTED'
                      ? 'rgba(251,191,36,.85)'
                      : 'rgba(var(--ink-rgb),.18)';
              const bar = (
                <Bar
                  key={r.id}
                  x={cursor}
                  y={0}
                  width={w}
                  height={H}
                  rx={4}
                  fill={fill}
                  stroke={tone.border}
                  strokeWidth={1}
                >
                  <title>
                    {`${r.titleAr} — ${tone.label} — ${r.releasePct}%`}
                  </title>
                </Bar>
              );
              cursor += w;
              return bar;
            })}
          </Group>
        </svg>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 12, fontSize: 12 }}>
          {(['RELEASED', 'APPROVED', 'SUBMITTED', 'PENDING'] as const).map((s) => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: STATUS_TONE[s].color,
                  display: 'inline-block',
                }}
              />
              <span style={{ color: 'var(--muted)' }}>{STATUS_TONE[s].label}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function MilestoneCard({ m }: { m: MilestoneRow }): React.ReactElement {
  const tone = STATUS_TONE[m.status];
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid rgba(var(--ink-rgb),.08)',
        borderRadius: 14,
        padding: '14px 18px',
        display: 'flex',
        gap: 16,
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: 'rgba(var(--ink-rgb),.05)',
          display: 'grid',
          placeItems: 'center',
          fontWeight: 700,
          color: 'var(--muted)',
          flexShrink: 0,
        }}
      >
        <Num>{m.order}</Num>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{m.titleAr}</div>
          <span
            style={{
              background: tone.bg,
              color: tone.color,
              border: `1px solid ${tone.border}`,
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 20,
              whiteSpace: 'nowrap',
            }}
          >
            {tone.label}
          </span>
        </div>
        {m.evidenceRequired && (
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
            الإثبات المطلوب: {m.evidenceRequired}
          </div>
        )}
        <div style={{ display: 'flex', gap: 18, marginTop: 8, fontSize: 12, color: 'var(--muted)', flexWrap: 'wrap' }}>
          <span>نسبة الصرف: <Num style={{ fontWeight: 700, color: 'var(--text)' }}>{m.releasePct}%</Num></span>
          {m.releasedHalalas > 0 && (
            <span>تم صرف: <Num style={{ fontWeight: 700, color: 'var(--accent)' }}>{halalasToSar(m.releasedHalalas)} ر.س</Num></span>
          )}
          {m.releasedAt && <span>تاريخ الصرف: {formatDateAr(m.releasedAt)}</span>}
          {!m.releasedAt && m.approvedAt && <span>الموافقة: {formatDateAr(m.approvedAt)}</span>}
          {!m.approvedAt && m.submittedAt && <span>التقديم: {formatDateAr(m.submittedAt)}</span>}
        </div>
        {m.evidenceUrl && (
          <a
            href={m.evidenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              color: 'var(--accent)',
              marginTop: 8,
              textDecoration: 'none',
            }}
          >
            عرض الإثبات <Icon name="open_in_new" size={12} />
          </a>
        )}
      </div>
    </div>
  );
}

function SkeletonBlock(): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            background: 'var(--card)',
            border: '1px solid rgba(var(--ink-rgb),.08)',
            borderRadius: 14,
            padding: 22,
            height: 70,
            opacity: 0.6,
          }}
        />
      ))}
    </div>
  );
}
