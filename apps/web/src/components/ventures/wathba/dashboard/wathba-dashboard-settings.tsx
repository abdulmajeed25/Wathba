'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { ApiProjectDetail } from '@/lib/api/wathba';

/* ─────── Static enums + labels ──────────────────────────────────────────────
 * Kept colocated so we don't drag the @prisma/client enum into the browser
 * bundle. Mirrors apps/api/prisma/schema.prisma's ProjectCategory enum.
 */
const CATEGORIES: ReadonlyArray<{ value: string; labelAr: string }> = [
  { value: 'TECH', labelAr: 'تقنية' },
  { value: 'DESIGN', labelAr: 'تصميم' },
  { value: 'FILM', labelAr: 'أفلام' },
  { value: 'MUSIC', labelAr: 'موسيقى' },
  { value: 'FOOD', labelAr: 'طعام' },
  { value: 'GAMES', labelAr: 'ألعاب' },
  { value: 'PUBLISHING', labelAr: 'نشر' },
  { value: 'FASHION', labelAr: 'أزياء' },
  { value: 'ART', labelAr: 'فن' },
  { value: 'SOCIAL', labelAr: 'اجتماعي' },
];

const STATUS_LABELS: Readonly<Record<string, string>> = {
  DRAFT: 'مسوّدة',
  UNDER_REVIEW: 'قيد المراجعة',
  LIVE: 'منشور',
  SUCCESSFUL: 'ناجح',
  FAILED: 'متعثّر',
  FUNDED: 'مموَّل',
  IN_PRODUCTION: 'قيد التصنيع',
  DELIVERED: 'مُسلَّم',
  REFUNDED: 'مُعاد',
};

const STATUS_COLORS: Readonly<Record<string, string>> = {
  DRAFT: '#6b7280',
  UNDER_REVIEW: '#f59e0b',
  LIVE: '#05a661',
  SUCCESSFUL: '#05a661',
  FUNDED: '#05a661',
  IN_PRODUCTION: '#6366f1',
  DELIVERED: '#6366f1',
  FAILED: '#ef4444',
  REFUNDED: '#ef4444',
};

const fmtSAR = (h: number): string => `${(h / 100).toLocaleString('en-US')} ر.س`;

/* ─────── Public component ─────────────────────────────────────────────────── */

export function DashboardSettings({
  project,
}: {
  project: ApiProjectDetail;
}): React.ReactElement {
  const router = useRouter();

  // The PATCH endpoint is gated on DRAFT | UNDER_REVIEW (see apps/api/projects.service).
  const editable = project.status === 'DRAFT' || project.status === 'UNDER_REVIEW';

  // ── Basics form ──────────────────────────────────────────────────────────
  const [titleAr, setTitleAr] = useState(project.titleAr);
  const [shortDescAr, setShortDescAr] = useState(project.shortDescAr);
  const [category, setCategory] = useState(project.category);

  // ── Funding form ─────────────────────────────────────────────────────────
  const [goalSAR, setGoalSAR] = useState((project.fundingGoalHalalas / 100).toString());
  const [threshold, setThreshold] = useState(project.releaseThresholdPct);

  // ── UX state ─────────────────────────────────────────────────────────────
  const [busySection, setBusySection] = useState<
    'basics' | 'funding' | 'visibility' | null
  >(null);
  const [sectionMsg, setSectionMsg] = useState<
    Partial<Record<'basics' | 'funding' | 'visibility', { kind: 'ok' | 'err'; text: string }>>
  >({});

  /* fundingGoal must always cover what's already raised. The API does NOT
   * enforce this (its only floor is 10_000 halalas / 100 SAR), so we catch
   * it on the client to avoid corrupting the progress bar math. */
  const goalHalalas = useMemo(() => {
    const n = Number(goalSAR);
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }, [goalSAR]);

  const goalError =
    goalHalalas > 0 && goalHalalas < project.raisedHalalas
      ? `الهدف الجديد (${fmtSAR(goalHalalas)}) أقلّ ممّا تم جمعه فعلاً (${fmtSAR(project.raisedHalalas)})`
      : goalHalalas > 0 && goalHalalas < 10_000
        ? 'الحدّ الأدنى للهدف ١٠٠ ر.س'
        : null;

  /* ─── Action helpers ─────────────────────────────────────────────────── */

  const patch = async (
    section: 'basics' | 'funding',
    body: Record<string, unknown>,
  ): Promise<void> => {
    setBusySection(section);
    setSectionMsg((m) => ({ ...m, [section]: undefined }));
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text.slice(0, 200)}`);
      }
      setSectionMsg((m) => ({
        ...m,
        [section]: { kind: 'ok', text: 'تم الحفظ بنجاح' },
      }));
      router.refresh();
    } catch (e) {
      setSectionMsg((m) => ({
        ...m,
        [section]: { kind: 'err', text: `فشل الحفظ — ${(e as Error).message}` },
      }));
    } finally {
      setBusySection(null);
    }
  };

  const saveBasics = (): Promise<void> =>
    patch('basics', { titleAr, shortDescAr, category });

  const saveFunding = (): Promise<void> => {
    if (goalError) {
      setSectionMsg((m) => ({ ...m, funding: { kind: 'err', text: goalError } }));
      return Promise.resolve();
    }
    return patch('funding', {
      fundingGoalHalalas: goalHalalas,
      releaseThresholdPct: threshold,
    });
  };

  const submitForReview = async (): Promise<void> => {
    if (
      !confirm(
        'سيتمّ إرسال الحملة لمراجعة الإدارة. لن تتمكّن من تعديل البيانات الأساسية أثناء المراجعة. متابعة؟',
      )
    )
      return;
    setBusySection('visibility');
    setSectionMsg((m) => ({ ...m, visibility: undefined }));
    try {
      const res = await fetch(`/api/projects/${project.id}/submit`, { method: 'POST' });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text.slice(0, 200)}`);
      }
      setSectionMsg((m) => ({
        ...m,
        visibility: { kind: 'ok', text: 'تم الإرسال للمراجعة' },
      }));
      router.refresh();
    } catch (e) {
      setSectionMsg((m) => ({
        ...m,
        visibility: { kind: 'err', text: `فشل الإرسال — ${(e as Error).message}` },
      }));
    } finally {
      setBusySection(null);
    }
  };

  /* ─── Render ─────────────────────────────────────────────────────────── */

  const deadlineFmt = new Date(project.deadline).toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 6 }}>
          الإعدادات
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary, #3b4942)', margin: 0 }}>
          بيانات الحملة الأساسية، الهدف، عتبة الإفراج، والرؤية.
        </p>
      </div>

      {!editable && (
        <Banner kind="info">
          الحالة الحالية «{STATUS_LABELS[project.status] ?? project.status}» — لا يمكن
          تعديل البيانات الأساسية إلا في حالتَي «مسوّدة» أو «قيد المراجعة».
        </Banner>
      )}

      {/* ── Basics ────────────────────────────────────────────────────── */}
      <Card title="بيانات الحملة الأساسية">
        <Field label="عنوان الحملة (عربي)">
          <input
            type="text"
            value={titleAr}
            onChange={(e) => setTitleAr(e.target.value)}
            maxLength={120}
            disabled={!editable}
            style={inputStyle(editable)}
          />
          <Hint>{titleAr.length}/120 حرفاً — الحدّ الأدنى ٤ أحرف</Hint>
        </Field>

        <Field label="وصف مختصر">
          <textarea
            value={shortDescAr}
            onChange={(e) => setShortDescAr(e.target.value)}
            maxLength={240}
            rows={2}
            disabled={!editable}
            style={{ ...inputStyle(editable), fontFamily: 'inherit', resize: 'vertical' }}
          />
          <Hint>{shortDescAr.length}/240 حرفاً — يظهر تحت العنوان في البطاقة</Hint>
        </Field>

        <Field label="التصنيف">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={!editable}
            style={inputStyle(editable)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.labelAr}
              </option>
            ))}
          </select>
        </Field>

        <SectionFooter
          status={sectionMsg.basics}
          action={
            <button
              type="button"
              disabled={!editable || busySection !== null || titleAr.length < 4}
              onClick={saveBasics}
              style={primaryBtnStyle(editable && busySection === null && titleAr.length >= 4)}
            >
              {busySection === 'basics' ? 'جارٍ الحفظ…' : 'حفظ البيانات'}
            </button>
          }
        />
      </Card>

      {/* ── Funding ───────────────────────────────────────────────────── */}
      <Card title="الهدف وعتبة الإفراج">
        <Field label="هدف التمويل (ر.س)">
          <input
            type="number"
            min={100}
            step={100}
            value={goalSAR}
            onChange={(e) => setGoalSAR(e.target.value)}
            disabled={!editable}
            style={inputStyle(editable)}
          />
          <Hint>
            ما تمّ جمعه حتى الآن: <strong>{fmtSAR(project.raisedHalalas)}</strong> ·
            عدد الداعمين: {project.backersCount.toLocaleString('en-US')}
          </Hint>
          {goalError && <ErrorLine>{goalError}</ErrorLine>}
        </Field>

        <Field label={`عتبة الإفراج عن الأموال — ${threshold}٪`}>
          <input
            type="range"
            min={50}
            max={100}
            step={1}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            disabled={!editable}
            style={{ width: '100%' }}
          />
          <Hint>
            أقلّ نسبة من الهدف يجب بلوغها لصرف الأموال من الضمان (٨٠٪ افتراضياً، بين
            ٥٠٪ و١٠٠٪).
          </Hint>
        </Field>

        <ReadOnlyRow label="مدّة الحملة" value={`${project.durationDays} يوماً`} />
        <ReadOnlyRow label="الموعد النهائي" value={deadlineFmt} />
        <Hint>المدّة والموعد النهائي يُحدَّدان عند الإنشاء ولا يمكن تعديلهما هنا.</Hint>

        <SectionFooter
          status={sectionMsg.funding}
          action={
            <button
              type="button"
              disabled={!editable || busySection !== null || goalError !== null}
              onClick={saveFunding}
              style={primaryBtnStyle(editable && busySection === null && goalError === null)}
            >
              {busySection === 'funding' ? 'جارٍ الحفظ…' : 'حفظ الهدف والعتبة'}
            </button>
          }
        />
      </Card>

      {/* ── Theme ─────────────────────────────────────────────────────── */}
      <Card title="مظهر الصفحة">
        <div
          style={{
            padding: 14,
            background: 'rgba(99,102,241,0.06)',
            border: '1px dashed rgba(99,102,241,0.3)',
            borderRadius: 10,
            color: 'var(--text-secondary, #3b4942)',
            fontSize: 13,
          }}
        >
          قريباً — اختيار مظهر بصري للحملة (تجاري، أخضر، جامعي) سيُتاح في إصدار قادم.
        </div>
      </Card>

      {/* ── Visibility ────────────────────────────────────────────────── */}
      <Card title="الرؤية">
        <ReadOnlyRow
          label="الحالة الحالية"
          value={
            <StatusPill
              status={project.status}
              labelAr={STATUS_LABELS[project.status] ?? project.status}
            />
          }
        />

        {project.status === 'DRAFT' && (
          <>
            <Hint>
              عند الإرسال، تنتقل الحملة إلى حالة «قيد المراجعة». يقوم فريق وثبة بمراجعة
              المحتوى ثم يَنشر الحملة رسمياً (تبدأ ساعة العدّ التنازلي عند النشر).
            </Hint>
            <SectionFooter
              status={sectionMsg.visibility}
              action={
                <button
                  type="button"
                  disabled={busySection !== null || project.storyAr.length < 200}
                  onClick={submitForReview}
                  style={primaryBtnStyle(
                    busySection === null && project.storyAr.length >= 200,
                  )}
                >
                  {busySection === 'visibility' ? 'جارٍ الإرسال…' : 'إرسال للمراجعة'}
                </button>
              }
            />
            {project.storyAr.length < 200 && (
              <ErrorLine>
                لا يمكن الإرسال — يجب أن تكون قصّة الحملة ٢٠٠ حرف على الأقل (الحالي:{' '}
                {project.storyAr.length}).
              </ErrorLine>
            )}
          </>
        )}

        {project.status === 'UNDER_REVIEW' && (
          <Hint>
            الحملة قيد المراجعة. سيتم إعلامك عند اعتمادها أو طلب تعديلات. لا يوجد إجراء
            إلغاء ذاتي حالياً — تواصل مع الدعم لسحب الطلب.
          </Hint>
        )}

        {project.status === 'LIVE' && (
          <Hint>
            الحملة منشورة ومفعّلة. إيقاف النشر يتطلب تواصلاً مع فريق الدعم (لا يتوفّر
            إجراء إلغاء نشر ذاتي).
          </Hint>
        )}
      </Card>

      {/* ── Danger zone ───────────────────────────────────────────────── */}
      <Card title="منطقة الخطر" tone="danger">
        <Hint>حذف الحملة نهائياً — غير متوفّر حالياً. تواصل مع الدعم لطلب الحذف.</Hint>
        <div
          title="حذف الحملة غير مدعوم من واجهة الخادم حالياً"
          style={{ display: 'inline-block' }}
        >
          <button type="button" disabled style={dangerBtnDisabledStyle}>
            حذف الحملة
          </button>
        </div>
      </Card>
    </>
  );
}

/* ─────── Visual atoms (parallel to rewards-manager) ────────────────────────── */

function Card({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: 'default' | 'danger';
  children: React.ReactNode;
}): React.ReactElement {
  const isDanger = tone === 'danger';
  return (
    <section
      style={{
        background: 'var(--bg-elevated, #fff)',
        border: `1px solid ${
          isDanger ? 'rgba(239,68,68,0.3)' : 'var(--border-subtle, rgba(18,33,26,0.08))'
        }`,
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 700,
          color: isDanger ? '#b91c1c' : 'var(--text-primary, #16201b)',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
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
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 6,
          color: 'var(--text-secondary, #3b4942)',
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div
      style={{
        fontSize: 12,
        color: 'var(--text-tertiary, #5d6b62)',
        marginTop: 6,
      }}
    >
      {children}
    </div>
  );
}

function ErrorLine({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 6, fontWeight: 600 }}>
      {children}
    </div>
  );
}

function Banner({
  kind,
  children,
}: {
  kind: 'info' | 'err';
  children: React.ReactNode;
}): React.ReactElement {
  const isErr = kind === 'err';
  return (
    <div
      style={{
        padding: 12,
        background: isErr ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
        border: `1px solid ${isErr ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
        borderRadius: 10,
        color: isErr ? '#b91c1c' : '#92400e',
        marginBottom: 16,
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}

function ReadOnlyRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 13,
        padding: '6px 0',
      }}
    >
      <span style={{ color: 'var(--text-secondary, #3b4942)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: 'var(--text-primary, #16201b)' }}>
        {value}
      </span>
    </div>
  );
}

function StatusPill({
  status,
  labelAr,
}: {
  status: string;
  labelAr: string;
}): React.ReactElement {
  const color = STATUS_COLORS[status] ?? '#6b7280';
  return (
    <span
      style={{
        fontSize: 11,
        padding: '3px 10px',
        borderRadius: 30,
        background: `${color}15`,
        color,
        fontWeight: 700,
      }}
    >
      {labelAr}
    </span>
  );
}

function SectionFooter({
  status,
  action,
}: {
  status?: { kind: 'ok' | 'err'; text: string };
  action: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        marginTop: 6,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600 }}>
        {status?.kind === 'ok' && <span style={{ color: '#05a661' }}>✓ {status.text}</span>}
        {status?.kind === 'err' && <span style={{ color: '#b91c1c' }}>{status.text}</span>}
      </div>
      <div>{action}</div>
    </div>
  );
}

/* ─────── Styles ───────────────────────────────────────────────────────────── */

const inputStyle = (enabled: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--border-subtle, rgba(18,33,26,0.16))',
  borderRadius: 8,
  fontSize: 14,
  background: enabled ? 'var(--bg-elevated, #fff)' : 'rgba(0,0,0,0.03)',
  color: 'var(--text-primary, #16201b)',
  fontFamily: 'inherit',
  opacity: enabled ? 1 : 0.7,
});

const primaryBtnStyle = (enabled: boolean): React.CSSProperties => ({
  padding: '10px 18px',
  background: enabled ? 'var(--brand-primary, #05a661)' : 'rgba(0,0,0,0.12)',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  fontWeight: 700,
  fontSize: 14,
  cursor: enabled ? 'pointer' : 'not-allowed',
  fontFamily: 'inherit',
});

const dangerBtnDisabledStyle: React.CSSProperties = {
  padding: '10px 18px',
  background: 'rgba(0,0,0,0.06)',
  color: 'rgba(239,68,68,0.55)',
  border: '1px solid rgba(239,68,68,0.2)',
  borderRadius: 10,
  fontWeight: 700,
  fontSize: 14,
  cursor: 'not-allowed',
  fontFamily: 'inherit',
};
