'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import type { ApiContest, ContestStatusVal } from '@/lib/api/wathba';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Creator-only manager for "علّق واربح" contest rounds.                     */
/* ────────────────────────────────────────────────────────────────────────── */

const STATUS_LABEL: Record<ContestStatusVal, string> = {
  DRAFT: 'مسودة',
  OPEN: 'مفتوحة',
  CLOSED: 'مغلقة',
  ANNOUNCED: 'مُعلَنة',
};

const STATUS_COLOR: Record<ContestStatusVal, string> = {
  DRAFT: '#9ca3af',
  OPEN: '#10b981',
  CLOSED: '#f59e0b',
  ANNOUNCED: '#6366f1',
};

type FilterId = 'all' | ContestStatusVal;

const FILTERS: Array<{ id: FilterId; label: string }> = [
  { id: 'all',       label: 'الكل' },
  { id: 'OPEN',      label: 'مفتوحة' },
  { id: 'ANNOUNCED', label: 'أُعلنت' },
  { id: 'CLOSED',    label: 'مغلقة' },
  { id: 'DRAFT',     label: 'مسودّات' },
];

export function ContestsManager({
  projectId,
  initial,
}: {
  projectId: string;
  initial: ApiContest[];
}): React.ReactElement {
  // Sort by round desc so the newest sits on top.
  const sorted = [...initial].sort((a, b) => b.roundNum - a.roundNum);
  const [filter, setFilter] = useState<FilterId>('all');
  const counts: Record<FilterId, number> = {
    all: sorted.length,
    DRAFT: 0, OPEN: 0, CLOSED: 0, ANNOUNCED: 0,
  };
  for (const c of sorted) counts[c.status] += 1;

  const visible = filter === 'all' ? sorted : sorted.filter((c) => c.status === filter);
  const totalWinners = sorted
    .filter((c) => c.status === 'ANNOUNCED')
    .reduce((acc, c) => acc + c.winners.length, 0);
  const nextRoundNum = (sorted[0]?.roundNum ?? 0) + 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader
        title="علّق واربح"
        subtitle="أنشئ جولات جوائز للتفاعل مع الداعمين، واختر الفائزين بأرقامهم العامّة (مثل #128) لحماية الخصوصية."
      />

      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
        }}
      >
        <Kpi label="إجمالي الجولات" value={sorted.length} accent="var(--brand-primary, #05a661)" />
        <Kpi label="جولات مفتوحة الآن" value={counts.OPEN} accent="var(--blue, #2563eb)" />
        <Kpi label="جولات أُعلِنت" value={counts.ANNOUNCED} accent="var(--purple, #6d4df0)" />
        <Kpi label="إجمالي الفائزين" value={totalWinners} accent="var(--gold, #b9820a)" />
      </div>

      <CreateRoundCard projectId={projectId} nextRound={nextRoundNum} />

      {/* Status filter tabs */}
      {sorted.length > 0 && (
        <div
          role="tablist"
          aria-label="فلترة الجولات حسب الحالة"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            borderBottom: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
            paddingBottom: 4,
          }}
        >
          {FILTERS.map((f) => {
            const n = counts[f.id];
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(f.id)}
                style={{
                  cursor: 'pointer',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `2px solid ${active ? 'var(--brand-primary, #05a661)' : 'transparent'}`,
                  color: active ? 'var(--brand-primary, #05a661)' : 'var(--text-secondary, #3b4942)',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  fontSize: 13,
                  padding: '8px 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {f.label}
                <span
                  style={{
                    fontSize: 11,
                    background: 'rgba(var(--ink-rgb), .06)',
                    color: 'var(--text-secondary, #3b4942)',
                    padding: '1px 7px',
                    borderRadius: 999,
                    minWidth: 18,
                    textAlign: 'center',
                  }}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {sorted.length === 0 ? (
          <EmptyHint />
        ) : visible.length === 0 ? (
          <div
            style={{
              padding: 18,
              background: 'var(--bg-elevated, #fff)',
              border: '1px dashed var(--border-strong, rgba(18,33,26,0.16))',
              borderRadius: 12,
              textAlign: 'center',
              fontSize: 13,
              color: 'var(--text-secondary, #3b4942)',
            }}
          >
            لا جولات في هذه الحالة. جرّب فلتراً آخر.
          </div>
        ) : (
          visible.map((c) => <RoundCard key={c.id} projectId={projectId} contest={c} />)
        )}
      </div>
    </div>
  );
}

function Kpi({
  label, value, accent,
}: { label: string; value: number; accent: string }): React.ReactElement {
  return (
    <div
      style={{
        background: 'var(--bg-elevated, #fff)',
        border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
        borderRadius: 12,
        padding: '14px 16px',
      }}
    >
      <div style={{ fontSize: 11.5, color: 'var(--text-secondary, #3b4942)', letterSpacing: '.04em' }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: accent,
          marginTop: 4,
          fontFamily: '"Space Grotesk", sans-serif',
          fontFeatureSettings: '"tnum"',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }): React.ReactElement {
  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 6 }}>{title}</h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary, #3b4942)', margin: 0 }}>{subtitle}</p>
    </div>
  );
}

function EmptyHint(): React.ReactElement {
  return (
    <div
      style={{
        padding: 24,
        background: 'var(--bg-elevated, #fff)',
        border: '1px dashed var(--border-strong, rgba(18,33,26,0.16))',
        borderRadius: 12,
        textAlign: 'center',
        fontSize: 14,
        color: 'var(--text-secondary, #3b4942)',
      }}
    >
      لم تنشئ أي جولة بعد. ابدأ بإنشاء «الجولة 1» من النموذج أعلاه.
    </div>
  );
}

/* ──────────────── Create-round form ──────────────── */

function CreateRoundCard({
  projectId,
  nextRound,
}: {
  projectId: string;
  nextRound: number;
}): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [prizeType, setPrizeType] = useState<'tier' | 'addon' | 'custom'>('custom');
  const [prompt, setPrompt] = useState('');
  const [tierId, setTierId] = useState('');
  const [addOnId, setAddOnId] = useState('');
  const [custom, setCustom] = useState('');
  const [winners, setWinners] = useState(3);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    setError(null);
    const body: Record<string, unknown> = {
      promptAr: prompt,
      winnersCount: winners,
    };
    if (prizeType === 'tier') body.prizeRewardTierId = tierId || undefined;
    if (prizeType === 'addon') body.prizeAddOnId = addOnId || undefined;
    if (prizeType === 'custom') body.prizeCustomAr = custom || undefined;
    if (startsAt) body.startsAt = new Date(startsAt).toISOString();
    if (endsAt) body.endsAt = new Date(endsAt).toISOString();

    const res = await fetch(`/api/contests/${projectId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(`فشل الإنشاء (${res.status}): ${(j as { message?: string }).message ?? ''}`);
      return;
    }
    setPrompt('');
    setCustom('');
    setTierId('');
    setAddOnId('');
    startTransition(() => router.refresh());
  }

  return (
    <Card>
      <CardTitle>إنشاء الجولة {nextRound}</CardTitle>

      <Field label="سؤال الجولة (يظهر للداعمين)">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="مثل: علّق بأطرف اقتراح اسم للنسخة الجديدة وستربح!"
          style={textareaStyle}
        />
      </Field>

      <Field label="نوع الجائزة">
        <div style={{ display: 'flex', gap: 8 }}>
          {(['custom', 'tier', 'addon'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setPrizeType(t)}
              style={pillStyle(prizeType === t)}
            >
              {t === 'custom' ? 'جائزة مخصّصة' : t === 'tier' ? 'مكافأة من الحملة' : 'إضافة'}
            </button>
          ))}
        </div>
      </Field>

      {prizeType === 'custom' && (
        <Field label="وصف الجائزة">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="مثل: قميص بشعار الحملة + توقيع المبدع"
            style={inputStyle}
          />
        </Field>
      )}
      {prizeType === 'tier' && (
        <Field label="مُعرّف الـ Reward Tier (UUID)">
          <input
            value={tierId}
            onChange={(e) => setTierId(e.target.value)}
            placeholder="00000000-0000-…"
            style={inputStyle}
          />
        </Field>
      )}
      {prizeType === 'addon' && (
        <Field label="مُعرّف الـ AddOn (UUID)">
          <input
            value={addOnId}
            onChange={(e) => setAddOnId(e.target.value)}
            placeholder="00000000-0000-…"
            style={inputStyle}
          />
        </Field>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="عدد الفائزين">
          <input
            type="number"
            min={1}
            max={50}
            value={winners}
            onChange={(e) => setWinners(Math.max(1, Math.min(50, Number(e.target.value))))}
            style={inputStyle}
          />
        </Field>
        <Field label="بداية الجولة (اختياري)">
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="نهاية الجولة (اختياري)">
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            style={inputStyle}
          />
        </Field>
      </div>

      {error && <ErrorBanner text={error} />}

      <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 8 }}>
        <button
          type="button"
          onClick={submit}
          disabled={pending || prompt.trim().length < 4}
          style={primaryButtonStyle(pending || prompt.trim().length < 4)}
        >
          {pending ? 'جاري الإنشاء…' : 'إنشاء كمسودة'}
        </button>
      </div>
    </Card>
  );
}

/* ──────────────── Round card (per status actions) ──────────────── */

function RoundCard({
  projectId,
  contest,
}: {
  projectId: string;
  contest: ApiContest;
}): React.ReactElement {
  return (
    <Card>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary, #5d6b62)', marginBottom: 4 }}>
            الجولة {contest.roundNum}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.5 }}>{contest.promptAr}</div>
        </div>
        <StatusBadge status={contest.status} />
      </div>

      <div
        style={{
          display: 'flex',
          gap: 24,
          fontSize: 13,
          color: 'var(--text-secondary, #3b4942)',
          marginBottom: 12,
        }}
      >
        <span>عدد الفائزين: <strong>{contest.winnersCount}</strong></span>
        <span>الجائزة: <strong>{prizeLabel(contest)}</strong></span>
        {contest.announcedAt && (
          <span>أُعلِنت: {new Date(contest.announcedAt).toLocaleDateString('ar-SA')}</span>
        )}
      </div>

      {contest.winners.length > 0 && (
        <div
          style={{
            background: 'rgba(99,102,241,0.08)',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          الفائزون:{' '}
          {contest.winners
            .map((w) => w.backerNo)
            .sort((a, b) => a - b)
            .map((n) => `#${n}`)
            .join('، ')}
        </div>
      )}

      <RoundActions projectId={projectId} contest={contest} />
    </Card>
  );
}

function prizeLabel(c: ApiContest): string {
  if (c.prizeCustomAr) return c.prizeCustomAr;
  if (c.prizeRewardTierId) return 'مكافأة من الحملة';
  if (c.prizeAddOnId) return 'إضافة';
  return '—';
}

function StatusBadge({ status }: { status: ContestStatusVal }): React.ReactElement {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        background: `${STATUS_COLOR[status]}1f`,
        color: STATUS_COLOR[status],
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: STATUS_COLOR[status],
        }}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

function RoundActions({
  projectId,
  contest,
}: {
  projectId: string;
  contest: ApiContest;
}): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [announcePanel, setAnnouncePanel] = useState(false);

  async function call(path: string, method = 'POST', body?: unknown): Promise<void> {
    setError(null);
    const res = await fetch(path, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(`فشل الإجراء (${res.status}): ${(j as { message?: string }).message ?? ''}`);
      return;
    }
    setAnnouncePanel(false);
    startTransition(() => router.refresh());
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {contest.status === 'DRAFT' && (
          <>
            <button
              type="button"
              onClick={() => call(`/api/contests/${projectId}/${contest.id}/open`)}
              disabled={pending}
              style={primaryButtonStyle(pending)}
            >
              فتح الجولة
            </button>
            <button
              type="button"
              onClick={() => call(`/api/contests/${projectId}/${contest.id}`, 'DELETE')}
              disabled={pending}
              style={dangerButtonStyle(pending)}
            >
              حذف
            </button>
          </>
        )}
        {contest.status === 'OPEN' && (
          <button
            type="button"
            onClick={() => call(`/api/contests/${projectId}/${contest.id}/close`)}
            disabled={pending}
            style={primaryButtonStyle(pending)}
          >
            إغلاق الجولة
          </button>
        )}
        {contest.status === 'CLOSED' && (
          <button
            type="button"
            onClick={() => setAnnouncePanel((v) => !v)}
            disabled={pending}
            style={primaryButtonStyle(pending)}
          >
            {announcePanel ? 'إلغاء' : 'إعلان الفائزين'}
          </button>
        )}
      </div>

      {error && <ErrorBanner text={error} />}

      {announcePanel && contest.status === 'CLOSED' && (
        <AnnouncePanel
          projectId={projectId}
          contest={contest}
          onSubmit={(ids) =>
            call(`/api/contests/${projectId}/${contest.id}/announce`, 'POST', {
              winnerBackerIds: ids,
            })
          }
        />
      )}
    </>
  );
}

function AnnouncePanel({
  projectId: _projectId,
  contest,
  onSubmit,
}: {
  projectId: string;
  contest: ApiContest;
  onSubmit: (ids: string[]) => Promise<void> | void;
}): React.ReactElement {
  const [raw, setRaw] = useState('');
  const ids = raw
    .split(/[\s,،\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const valid = ids.length === contest.winnersCount;
  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        background: 'rgba(5,166,97,0.06)',
        borderRadius: 10,
        border: '1px solid rgba(5,166,97,0.18)',
      }}
    >
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        ألصق <strong>{contest.winnersCount}</strong> مُعرّف داعم (UUID v4) — مفصولة بمسافة أو فاصلة. سيتم
        التحقّق أنّهم داعمون مكتمل دفعهم.
      </div>
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={3}
        placeholder="00000000-0000-…, 11111111-…"
        style={textareaStyle}
      />
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
        <button
          type="button"
          disabled={!valid}
          onClick={() => onSubmit(ids)}
          style={primaryButtonStyle(!valid)}
        >
          إعلان النتائج وتثبيت تعليق
        </button>
        <span style={{ fontSize: 12, color: 'var(--text-secondary, #3b4942)' }}>
          {ids.length}/{contest.winnersCount}
        </span>
      </div>
    </div>
  );
}

/* ──────────────── Shared styles ──────────────── */

function Card({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div
      style={{
        background: 'var(--bg-elevated, #fff)',
        border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
        borderRadius: 14,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div style={{ fontSize: 17, fontWeight: 700 }}>{children}</div>;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary, #3b4942)', fontWeight: 600 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function ErrorBanner({ text }: { text: string }): React.ReactElement {
  return (
    <div
      style={{
        padding: '8px 12px',
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: 8,
        fontSize: 13,
        color: '#dc2626',
      }}
    >
      {text}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--border-strong, rgba(18,33,26,0.16))',
  fontSize: 14,
  background: 'var(--bg-base, #fff)',
  fontFamily: 'inherit',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical' as const,
  lineHeight: 1.6,
};

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 14px',
    borderRadius: 999,
    border: '1px solid var(--border-strong, rgba(18,33,26,0.16))',
    background: active ? 'var(--brand-primary, #05a661)' : 'transparent',
    color: active ? '#fff' : 'var(--text-primary, #16201b)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };
}

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '10px 18px',
    borderRadius: 10,
    border: 'none',
    background: disabled ? '#9ca3af' : 'var(--brand-primary, #05a661)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
  };
}

function dangerButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '10px 18px',
    borderRadius: 10,
    border: '1px solid rgba(239,68,68,0.3)',
    background: 'transparent',
    color: '#dc2626',
    fontSize: 14,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
  };
}
