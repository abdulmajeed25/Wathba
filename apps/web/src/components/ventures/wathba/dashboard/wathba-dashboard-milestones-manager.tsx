'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { ApiMilestonePublic, ApiSpendLog } from '@/lib/api/wathba';

/* ─── Local types (kept here — no SDK additions required) ──────────────── */

interface BudgetPayload {
  totalSpentHalalas: number;
  totalRaisedHalalas: number;
  rows: Array<{ label: string; amountHalalas: number; pct: number }>;
}

interface PlanRow {
  /* Local-only id for React keys while editing the draft plan. */
  rid: string;
  order: number;
  titleAr: string;
  releasePct: string;
  evidenceRequired: string;
}

interface SpendFormState {
  descAr: string;
  amountSAR: string;
  date: string;
  proofUrl: string;
  milestoneId: string;
}

const emptySpendForm: SpendFormState = {
  descAr: '',
  amountSAR: '',
  date: '',
  proofUrl: '',
  milestoneId: '',
};

/* ─── Formatting helpers ───────────────────────────────────────────────── */

const fmtSAR = (h: number): string => `${(h / 100).toLocaleString('en-US')} ر.س`;
const fmtPct = (p: number): string => `${p.toLocaleString('en-US')}%`;
const fmtDate = (iso: string | null): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('ar-SA-u-nu-latn', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
};

const STATUS_AR: Record<ApiMilestonePublic['status'], string> = {
  PENDING: 'في الانتظار',
  SUBMITTED: 'بانتظار المراجعة',
  APPROVED: 'موافَق عليها',
  RELEASED: 'تم الصرف',
};

const STATUS_COLOR: Record<ApiMilestonePublic['status'], string> = {
  PENDING: '#9ca3af',
  SUBMITTED: '#f59e0b',
  APPROVED: '#6366f1',
  RELEASED: '#10b981',
};

/* Allowed to edit the entire milestone plan in one shot.
 * Mirrors backend: only DRAFT / UNDER_REVIEW (see
 * milestones.service.ts → setMilestones). */
const PLAN_EDITABLE_STATUSES = new Set(['DRAFT', 'UNDER_REVIEW']);

/* Allowed to submit evidence + add spend logs.
 * Backend lets the creator add a spend log any time the project exists,
 * but evidence submission only matters once a milestone is PENDING and the
 * project is live/funded — that's enforced server-side too. */
const SPEND_EDITABLE_STATUSES = new Set([
  'LIVE',
  'SUCCESSFUL',
  'FUNDED',
  'IN_PRODUCTION',
  'DELIVERED',
]);

export function DashboardMilestonesManager({
  projectId,
  projectStatus,
  raisedHalalas,
  initialMilestones,
  initialBudget,
  initialSpendLog,
}: {
  projectId: string;
  projectStatus: string;
  raisedHalalas: number;
  initialMilestones: ApiMilestonePublic[];
  initialBudget: BudgetPayload;
  initialSpendLog: ApiSpendLog[];
}): React.ReactElement {
  const router = useRouter();
  const [tab, setTab] = useState<'plan' | 'transparency'>('plan');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const planEditable = PLAN_EDITABLE_STATUSES.has(projectStatus);
  const spendEditable = SPEND_EDITABLE_STATUSES.has(projectStatus);
  const anyInFlight = initialMilestones.some((m) => m.status !== 'PENDING');

  /* Plan draft: seeded from existing milestones, or a single empty row. */
  const [draft, setDraft] = useState<PlanRow[]>(() =>
    initialMilestones.length > 0
      ? initialMilestones.map((m) => ({
          rid: m.id,
          order: m.order,
          titleAr: m.titleAr,
          releasePct: String(m.releasePct),
          evidenceRequired: m.evidenceRequired,
        }))
      : [
          {
            rid: 'new-1',
            order: 1,
            titleAr: '',
            releasePct: '',
            evidenceRequired: '',
          },
        ],
  );

  const draftPctTotal = useMemo(
    () => draft.reduce((acc, r) => acc + (Number(r.releasePct) || 0), 0),
    [draft],
  );

  const totalReleasedHalalas = useMemo(
    () => initialMilestones.reduce((acc, m) => acc + m.releasedHalalas, 0),
    [initialMilestones],
  );

  /* Evidence per-milestone state. */
  const [evidenceUrls, setEvidenceUrls] = useState<Record<string, string>>({});
  const [evidenceUploading, setEvidenceUploading] = useState<Record<string, boolean>>({});

  /* Spend-log form. */
  const [spendForm, setSpendForm] = useState<SpendFormState>(emptySpendForm);

  /* ─── Mutations ───────────────────────────────────────────────────── */

  const savePlan = async (): Promise<void> => {
    setError(null);
    setNotice(null);
    if (draft.length === 0) {
      setError('أضف مرحلة واحدة على الأقل.');
      return;
    }
    for (const r of draft) {
      if (!r.titleAr || r.titleAr.trim().length < 4) {
        setError('كل مرحلة تحتاج عنوان (٤ أحرف فأكثر).');
        return;
      }
      const pct = Number(r.releasePct);
      if (!Number.isInteger(pct) || pct < 1 || pct > 100) {
        setError('نسبة الإفراج لكل مرحلة بين ١ و ١٠٠.');
        return;
      }
      if (!r.evidenceRequired || r.evidenceRequired.trim().length < 4) {
        setError('وضِّح الإثبات المطلوب لكل مرحلة.');
        return;
      }
    }
    if (draftPctTotal !== 100) {
      setError(`المجموع لازم يساوي ١٠٠% — حالياً ${draftPctTotal}%.`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/milestones', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          op: 'set-plan',
          projectId,
          data: {
            milestones: draft.map((r) => ({
              order: r.order,
              titleAr: r.titleAr.trim(),
              releasePct: Number(r.releasePct),
              evidenceRequired: r.evidenceRequired.trim(),
            })),
          },
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`فشل الحفظ (${res.status}): ${body.slice(0, 160)}`);
      }
      setNotice('تم حفظ خطة المراحل.');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const uploadEvidenceFile = async (
    milestoneId: string,
    file: File,
  ): Promise<void> => {
    setError(null);
    setNotice(null);
    setEvidenceUploading((m) => ({ ...m, [milestoneId]: true }));
    try {
      const presign = await fetch('/api/media/upload-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'evidence',
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        }),
      });
      if (!presign.ok) {
        const body = await presign.text();
        throw new Error(`فشل توقيع الرفع (${presign.status}): ${body.slice(0, 120)}`);
      }
      const { url, publicUrl } = (await presign.json()) as {
        url: string;
        key: string;
        publicUrl: string;
      };
      const put = await fetch(url, {
        method: 'PUT',
        headers: { 'content-type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!put.ok) {
        throw new Error(`فشل رفع الملف (${put.status}).`);
      }
      setEvidenceUrls((m) => ({ ...m, [milestoneId]: publicUrl }));
      setNotice('تم رفع الملف — اضغط «إرسال للمراجعة» لتسليمه.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEvidenceUploading((m) => ({ ...m, [milestoneId]: false }));
    }
  };

  const submitEvidence = async (milestoneId: string): Promise<void> => {
    setError(null);
    setNotice(null);
    const evidenceUrl = evidenceUrls[milestoneId]?.trim();
    if (!evidenceUrl) {
      setError('ارفع ملف الإثبات أو ألصق رابطاً قبل الإرسال.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/milestones', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          op: 'submit-evidence',
          projectId,
          milestoneId,
          data: { evidenceUrl },
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`فشل الإرسال (${res.status}): ${body.slice(0, 160)}`);
      }
      setNotice('تم إرسال الإثبات. بانتظار مراجعة الإدارة.');
      setEvidenceUrls((m) => {
        const next = { ...m };
        delete next[milestoneId];
        return next;
      });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const addSpendLog = async (): Promise<void> => {
    setError(null);
    setNotice(null);
    if (!spendForm.descAr || spendForm.descAr.trim().length < 4) {
      setError('اكتب وصفاً للصرفية (٤ أحرف فأكثر).');
      return;
    }
    const amountSAR = Number(spendForm.amountSAR);
    if (!Number.isFinite(amountSAR) || amountSAR < 1) {
      setError('المبلغ لازم يكون رقم صحيح وأكبر من صفر.');
      return;
    }
    const amountHalalas = Math.round(amountSAR * 100);
    if (amountHalalas < 100) {
      setError('الحد الأدنى ١ ر.س.');
      return;
    }
    setBusy(true);
    try {
      const data: Record<string, unknown> = {
        descAr: spendForm.descAr.trim(),
        amountHalalas,
      };
      if (spendForm.date) data.date = spendForm.date;
      if (spendForm.proofUrl) data.proofUrl = spendForm.proofUrl.trim();
      if (spendForm.milestoneId) data.milestoneId = spendForm.milestoneId;
      const res = await fetch('/api/milestones', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op: 'add-spend', projectId, data }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`فشل الحفظ (${res.status}): ${body.slice(0, 160)}`);
      }
      setSpendForm(emptySpendForm);
      setNotice('تمت إضافة السجل لسجل الصرف.');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /* ─── Render ──────────────────────────────────────────────────────── */

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 6 }}>
          المراحل والشفافية
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary, #3b4942)', margin: 0 }}>
          عرّف مراحل المشروع ونسبة الإفراج لكل مرحلة، ارفع الإثبات للمراجعة،
          وسجِّل المصاريف لتظهر في لوحة الشفافية للداعمين.
        </p>
      </div>

      <SummaryStrip
        raisedHalalas={raisedHalalas}
        releasedHalalas={totalReleasedHalalas}
        spentHalalas={initialBudget.totalSpentHalalas}
        milestoneCount={initialMilestones.length}
      />

      {error && <Alert tone="error" text={error} onClose={() => setError(null)} />}
      {notice && <Alert tone="ok" text={notice} onClose={() => setNotice(null)} />}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, marginTop: 16 }}>
        <TabBtn active={tab === 'plan'} onClick={() => setTab('plan')}>
          خطة المراحل ({initialMilestones.length})
        </TabBtn>
        <TabBtn active={tab === 'transparency'} onClick={() => setTab('transparency')}>
          الشفافية وسجل الصرف ({initialSpendLog.length})
        </TabBtn>
      </div>

      {tab === 'plan' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 24 }}>
          <div>
            {initialMilestones.length === 0 && (
              <EmptyState message="لا توجد مراحل بعد — حدّد الخطة من النموذج بجانبك." />
            )}
            {initialMilestones.map((m) => (
              <MilestoneCard
                key={m.id}
                milestone={m}
                raisedHalalas={raisedHalalas}
                pendingEvidenceUrl={evidenceUrls[m.id] ?? ''}
                uploading={evidenceUploading[m.id] ?? false}
                spendEditable={spendEditable}
                busy={busy}
                onPickFile={(file) => uploadEvidenceFile(m.id, file)}
                onChangeUrl={(v) =>
                  setEvidenceUrls((s) => ({ ...s, [m.id]: v }))
                }
                onSubmitEvidence={() => submitEvidence(m.id)}
              />
            ))}
          </div>

          <FormCard title={initialMilestones.length === 0 ? 'تعريف خطة المراحل' : 'تعديل خطة المراحل'}>
            {!planEditable && (
              <InfoBanner
                text={`في حالة ${projectStatus} لا يمكن تعديل الخطة. الخطة تُعرَّف قبل النشر فقط.`}
              />
            )}
            {planEditable && anyInFlight && (
              <InfoBanner text="مرحلة واحدة على الأقل تمّ إرسالها — لا يمكن إعادة تعريف الخطة." />
            )}
            {draft.map((row, idx) => (
              <PlanRowEditor
                key={row.rid}
                row={row}
                index={idx}
                disabled={!planEditable || anyInFlight}
                onChange={(patch) => {
                  setDraft((prev) => {
                    const next = [...prev];
                    next[idx] = { ...next[idx]!, ...patch };
                    return next;
                  });
                }}
                onRemove={() => {
                  setDraft((prev) => prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, order: i + 1 })));
                }}
              />
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                disabled={!planEditable || anyInFlight}
                onClick={() =>
                  setDraft((prev) => [
                    ...prev,
                    {
                      rid: `new-${Date.now()}`,
                      order: prev.length + 1,
                      titleAr: '',
                      releasePct: '',
                      evidenceRequired: '',
                    },
                  ])
                }
                style={ghostBtnStyle}
              >
                + إضافة مرحلة
              </button>
              <div style={{ fontSize: 12, color: draftPctTotal === 100 ? 'var(--brand-primary, #05a661)' : '#b91c1c', fontWeight: 700 }}>
                المجموع: {fmtPct(draftPctTotal)}
              </div>
            </div>
            <button
              type="button"
              disabled={busy || !planEditable || anyInFlight}
              onClick={savePlan}
              style={primaryBtnStyle}
            >
              {busy ? 'جارٍ الحفظ…' : 'حفظ خطة المراحل'}
            </button>
          </FormCard>
        </div>
      )}

      {tab === 'transparency' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 24 }}>
          <div>
            <SectionTitle>توزيع الميزانية</SectionTitle>
            <BudgetSplitCard budget={initialBudget} />

            <SectionTitle style={{ marginTop: 24 }}>سجل الصرف</SectionTitle>
            {initialSpendLog.length === 0 ? (
              <EmptyState message="ما في صرفيات مسجّلة بعد — أضف أوّل سجل من النموذج بجانبك." />
            ) : (
              initialSpendLog.map((s) => (
                <SpendLogRow
                  key={s.id}
                  log={s}
                  milestoneTitle={
                    initialMilestones.find((m) => m.id === s.milestoneId)?.titleAr ?? null
                  }
                />
              ))
            )}
          </div>

          <FormCard title="إضافة صرفية جديدة">
            {!spendEditable && (
              <InfoBanner
                text={`في حالة ${projectStatus} عادةً ما يكون السجل ساكناً. تقدر تسجّل الآن لكن لن يظهر للداعمين قبل نشر الحملة.`}
              />
            )}
            <Field label="الوصف">
              <input
                type="text"
                value={spendForm.descAr}
                onChange={(e) => setSpendForm({ ...spendForm, descAr: e.target.value })}
                style={inputStyle}
                placeholder="مثل: دفعة المصنّع — الجولة الأولى"
              />
            </Field>
            <Field label="المبلغ (ر.س)">
              <input
                type="number"
                min={1}
                value={spendForm.amountSAR}
                onChange={(e) => setSpendForm({ ...spendForm, amountSAR: e.target.value })}
                style={inputStyle}
              />
            </Field>
            <Field label="التاريخ (اختياري)">
              <input
                type="date"
                value={spendForm.date}
                onChange={(e) => setSpendForm({ ...spendForm, date: e.target.value })}
                style={inputStyle}
              />
            </Field>
            <Field label="رابط الإثبات (فاتورة/إيصال، اختياري)">
              <input
                type="url"
                value={spendForm.proofUrl}
                onChange={(e) => setSpendForm({ ...spendForm, proofUrl: e.target.value })}
                style={inputStyle}
                placeholder="https://..."
              />
            </Field>
            <Field label="اربطها بمرحلة (اختياري)">
              <select
                value={spendForm.milestoneId}
                onChange={(e) => setSpendForm({ ...spendForm, milestoneId: e.target.value })}
                style={inputStyle}
              >
                <option value="">— غير مرتبطة —</option>
                {initialMilestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.order}. {m.titleAr}
                  </option>
                ))}
              </select>
            </Field>
            <button type="button" disabled={busy} onClick={addSpendLog} style={primaryBtnStyle}>
              {busy ? 'جارٍ الحفظ…' : 'إضافة سجل صرف'}
            </button>
          </FormCard>
        </div>
      )}
    </>
  );
}

/* ─── Summary strip ────────────────────────────────────────────────────── */

function SummaryStrip({
  raisedHalalas,
  releasedHalalas,
  spentHalalas,
  milestoneCount,
}: {
  raisedHalalas: number;
  releasedHalalas: number;
  spentHalalas: number;
  milestoneCount: number;
}): React.ReactElement {
  const remaining = Math.max(0, raisedHalalas - releasedHalalas);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
        marginBottom: 16,
      }}
    >
      <Stat label="المُجمَّع من الداعمين" value={fmtSAR(raisedHalalas)} color="var(--brand-primary, #05a661)" />
      <Stat label="المُفرَج عنه" value={fmtSAR(releasedHalalas)} color="#10b981" />
      <Stat label="المُتبقّي في الضمان" value={fmtSAR(remaining)} color="#6366f1" />
      <Stat label="عدد المراحل" value={`${milestoneCount}`} color="#f59e0b" extra={`صُرفَ منها ${fmtSAR(spentHalalas)}`} />
    </div>
  );
}

function Stat({
  label,
  value,
  color,
  extra,
}: {
  label: string;
  value: string;
  color: string;
  extra?: string;
}): React.ReactElement {
  return (
    <div
      style={{
        background: 'var(--bg-elevated, #fff)',
        border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text-tertiary, #5d6b62)', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
      {extra && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary, #5d6b62)', marginTop: 2 }}>
          {extra}
        </div>
      )}
    </div>
  );
}

/* ─── Plan row editor ──────────────────────────────────────────────────── */

function PlanRowEditor({
  row,
  index,
  disabled,
  onChange,
  onRemove,
}: {
  row: PlanRow;
  index: number;
  disabled: boolean;
  onChange: (patch: Partial<PlanRow>) => void;
  onRemove: () => void;
}): React.ReactElement {
  return (
    <div
      style={{
        border: '1px solid var(--border-subtle, rgba(18,33,26,0.12))',
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
        background: disabled ? 'rgba(18,33,26,0.03)' : 'transparent',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #3b4942)' }}>
          المرحلة #{index + 1}
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          style={{ ...ghostBtnStyle, color: '#b91c1c', padding: '2px 8px', fontSize: 11 }}
        >
          إزالة
        </button>
      </div>
      <Field label="العنوان">
        <input
          type="text"
          value={row.titleAr}
          disabled={disabled}
          onChange={(e) => onChange({ titleAr: e.target.value })}
          style={inputStyle}
          placeholder="مثل: إنهاء النموذج الأوّلي"
        />
      </Field>
      <Field label="نسبة الإفراج (%)">
        <input
          type="number"
          min={1}
          max={100}
          value={row.releasePct}
          disabled={disabled}
          onChange={(e) => onChange({ releasePct: e.target.value })}
          style={inputStyle}
        />
      </Field>
      <Field label="الإثبات المطلوب">
        <textarea
          value={row.evidenceRequired}
          disabled={disabled}
          onChange={(e) => onChange({ evidenceRequired: e.target.value })}
          rows={2}
          style={{ ...inputStyle, fontFamily: 'inherit' }}
          placeholder="مثل: صور النموذج + فاتورة المصنع"
        />
      </Field>
    </div>
  );
}

/* ─── Milestone card (read-only state + evidence upload) ──────────────── */

function MilestoneCard({
  milestone,
  raisedHalalas,
  pendingEvidenceUrl,
  uploading,
  spendEditable,
  busy,
  onPickFile,
  onChangeUrl,
  onSubmitEvidence,
}: {
  milestone: ApiMilestonePublic;
  raisedHalalas: number;
  pendingEvidenceUrl: string;
  uploading: boolean;
  spendEditable: boolean;
  busy: boolean;
  onPickFile: (file: File) => void;
  onChangeUrl: (v: string) => void;
  onSubmitEvidence: () => void;
}): React.ReactElement {
  const projectedReleaseHalalas = Math.floor((raisedHalalas * milestone.releasePct) / 100);
  const releasedDisplay = milestone.status === 'RELEASED' ? milestone.releasedHalalas : projectedReleaseHalalas;
  const isReleased = milestone.status === 'RELEASED';
  return (
    <div
      style={{
        background: 'var(--bg-elevated, #fff)',
        border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: 'rgba(5,166,97,0.10)',
              color: 'var(--brand-primary, #05a661)',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {milestone.order}
          </span>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{milestone.titleAr}</div>
          <Pill label={STATUS_AR[milestone.status]} color={STATUS_COLOR[milestone.status]} />
        </div>
        <div style={{ textAlign: 'end' }}>
          <div style={{ fontWeight: 700, color: 'var(--brand-primary, #05a661)' }}>
            {fmtPct(milestone.releasePct)} · {fmtSAR(releasedDisplay)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary, #5d6b62)' }}>
            {isReleased ? 'تم الصرف من الضمان' : 'سيُفرَج عند الموافقة'}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 13, color: 'var(--text-secondary, #3b4942)', marginTop: 10 }}>
        <strong>الإثبات المطلوب:</strong> {milestone.evidenceRequired}
      </div>

      {milestone.evidenceUrl && (
        <div style={{ marginTop: 8, fontSize: 12 }}>
          <a
            href={milestone.evidenceUrl}
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--brand-primary, #05a661)', textDecoration: 'underline' }}
          >
            عرض الإثبات المُرسَل
          </a>
        </div>
      )}

      {milestone.status === 'PENDING' && spendEditable && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: 'rgba(99,102,241,0.06)',
            border: '1px dashed rgba(99,102,241,0.3)',
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>رفع إثبات هذه المرحلة</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <label
              style={{
                ...ghostBtnStyle,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: uploading ? 'wait' : 'pointer',
              }}
            >
              {uploading ? 'جارٍ الرفع…' : 'اختر ملفاً'}
              <input
                type="file"
                style={{ display: 'none' }}
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onPickFile(file);
                  e.target.value = '';
                }}
                accept="image/*,application/pdf,video/*"
              />
            </label>
            <input
              type="url"
              value={pendingEvidenceUrl}
              onChange={(e) => onChangeUrl(e.target.value)}
              placeholder="أو ألصق رابطاً مباشراً https://..."
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
          <button
            type="button"
            disabled={busy || !pendingEvidenceUrl}
            onClick={onSubmitEvidence}
            style={{ ...primaryBtnStyle, padding: '8px 14px', width: 'auto' }}
          >
            إرسال للمراجعة
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 12, fontSize: 11, color: 'var(--text-tertiary, #5d6b62)' }}>
        <Timestamp label="أُرسِل" iso={milestone.submittedAt} />
        <Timestamp label="وُوفِق" iso={milestone.approvedAt} />
        <Timestamp label="صُرِف" iso={milestone.releasedAt} />
      </div>
    </div>
  );
}

function Timestamp({ label, iso }: { label: string; iso: string | null }): React.ReactElement {
  return (
    <span>
      <span style={{ fontWeight: 600 }}>{label}:</span> {fmtDate(iso)}
    </span>
  );
}

/* ─── Transparency cards ───────────────────────────────────────────────── */

function BudgetSplitCard({ budget }: { budget: BudgetPayload }): React.ReactElement {
  if (budget.rows.length === 0) {
    return <EmptyState message="ما في توزيع ميزانية بعد. أضف مراحل + صرفيات." />;
  }
  return (
    <div
      style={{
        background: 'var(--bg-elevated, #fff)',
        border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
        borderRadius: 12,
        padding: 18,
        marginBottom: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, fontSize: 13 }}>
        <span style={{ color: 'var(--text-secondary, #3b4942)' }}>
          إجمالي المصروف: <strong>{fmtSAR(budget.totalSpentHalalas)}</strong>
        </span>
        <span style={{ color: 'var(--text-secondary, #3b4942)' }}>
          من أصل: <strong>{fmtSAR(budget.totalRaisedHalalas)}</strong>
        </span>
      </div>
      {budget.rows.map((r, i) => (
        <div key={`${r.label}-${i}`} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span>{r.label}</span>
            <span style={{ color: 'var(--text-tertiary, #5d6b62)' }}>
              {fmtSAR(r.amountHalalas)} · {fmtPct(r.pct)}
            </span>
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 30,
              background: 'rgba(18,33,26,0.06)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, Math.max(0, r.pct))}%`,
                background: BAR_COLORS[i % BAR_COLORS.length],
                borderRadius: 30,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

const BAR_COLORS = [
  'linear-gradient(90deg,#05a661,#10b981)',
  'linear-gradient(90deg,#6366f1,#3b82f6)',
  'linear-gradient(90deg,#f59e0b,#f97316)',
  'linear-gradient(90deg,#a855f7,#ec4899)',
];

function SpendLogRow({
  log,
  milestoneTitle,
}: {
  log: ApiSpendLog;
  milestoneTitle: string | null;
}): React.ReactElement {
  return (
    <div
      style={{
        background: 'var(--bg-elevated, #fff)',
        border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{log.descAr}</div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary, #5d6b62)', marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span>{fmtDate(log.date)}</span>
          {milestoneTitle && <span>↳ {milestoneTitle}</span>}
          {log.proofUrl && (
            <a
              href={log.proofUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--brand-primary, #05a661)', textDecoration: 'underline' }}
            >
              إثبات
            </a>
          )}
        </div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#b91c1c' }}>
        − {fmtSAR(log.amountHalalas)}
      </div>
    </div>
  );
}

/* ─── Visual atoms (mirrors rewards manager) ──────────────────────────── */

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--border-subtle, rgba(18,33,26,0.16))',
  borderRadius: 8,
  fontSize: 14,
  background: 'var(--bg-elevated, #fff)',
  color: 'var(--text-primary, #16201b)',
  fontFamily: 'inherit',
};

const primaryBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: 'var(--brand-primary, #05a661)',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const ghostBtnStyle: React.CSSProperties = {
  padding: '6px 10px',
  background: 'transparent',
  border: '1px dashed var(--border-strong, rgba(18,33,26,0.16))',
  borderRadius: 8,
  fontSize: 12,
  cursor: 'pointer',
  color: 'var(--text-secondary, #3b4942)',
  fontFamily: 'inherit',
};

function SectionTitle({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}): React.ReactElement {
  return (
    <h2
      style={{
        fontSize: 15,
        fontWeight: 700,
        margin: 0,
        marginBottom: 10,
        color: 'var(--text-primary, #16201b)',
        ...(style ?? {}),
      }}
    >
      {children}
    </h2>
  );
}

function TabBtn({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 14px',
        background: active ? 'var(--brand-primary, #05a661)' : 'transparent',
        color: active ? '#fff' : 'var(--text-primary, #16201b)',
        border: '1px solid var(--border-subtle, rgba(18,33,26,0.16))',
        borderRadius: 10,
        fontWeight: 600,
        fontSize: 13,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

function FormCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      style={{
        background: 'var(--bg-elevated, #fff)',
        border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
        borderRadius: 12,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        height: 'fit-content',
        position: 'sticky',
        top: 24,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{title}</div>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary, #3b4942)' }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }): React.ReactElement {
  return (
    <div
      style={{
        padding: 32,
        background: 'var(--bg-elevated, #fff)',
        border: '1px dashed var(--border-strong, rgba(18,33,26,0.16))',
        borderRadius: 12,
        textAlign: 'center',
        color: 'var(--text-secondary, #3b4942)',
        fontSize: 14,
      }}
    >
      {message}
    </div>
  );
}

function Pill({ label, color }: { label: string; color: string }): React.ReactElement {
  return (
    <span
      style={{
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 30,
        background: `${color}15`,
        color,
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  );
}

function Alert({
  tone,
  text,
  onClose,
}: {
  tone: 'error' | 'ok';
  text: string;
  onClose: () => void;
}): React.ReactElement {
  const palette =
    tone === 'error'
      ? { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)', fg: '#b91c1c' }
      : { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.3)', fg: '#047857' };
  return (
    <div
      style={{
        padding: 12,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: 10,
        color: palette.fg,
        marginBottom: 12,
        fontSize: 14,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span>{text}</span>
      <button
        type="button"
        onClick={onClose}
        style={{
          background: 'transparent',
          border: 'none',
          color: palette.fg,
          fontWeight: 700,
          cursor: 'pointer',
          fontSize: 16,
          lineHeight: 1,
        }}
        aria-label="إغلاق"
      >
        ×
      </button>
    </div>
  );
}

function InfoBanner({ text }: { text: string }): React.ReactElement {
  return (
    <div
      style={{
        padding: 10,
        background: 'rgba(99,102,241,0.06)',
        border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: 8,
        color: '#4338ca',
        fontSize: 12,
        marginBottom: 4,
      }}
    >
      {text}
    </div>
  );
}
