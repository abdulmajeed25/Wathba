'use client';

import { useState } from 'react';

import { submitProjectAction } from '@/lib/projects/submit-action';
import { WathbaCategoryPicker } from '@/components/ventures/wathba/wathba-category-picker';
import { REGIONS } from '@/components/ventures/wathba/discover-all-constants';
import { formatSar } from '@/lib/i18n/format';

/**
 * Submit-project wizard (Tier 2.8 rewrite).
 *
 * Five steps; each maps to real CreateProjectDto fields. On the final step
 * the form action posts to `submitProjectAction` which:
 *   1. POST /v1/projects                (DRAFT)
 *   2. POST /v1/projects/:id/submit     (DRAFT → UNDER_REVIEW)
 *   3. redirects to /projects/dashboard/:id?ok=submitted
 *
 * The wizard keeps client-side draft state so users can move back and forth
 * without losing input; only the final step submits.
 */

const STEPS = [
  { id: 'basics', label: 'الأساسيات' },
  { id: 'story', label: 'القصة' },
  { id: 'funding', label: 'التمويل' },
  { id: 'delivery', label: 'التسليم' },
  { id: 'review', label: 'المراجعة' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

interface Draft {
  titleAr: string;
  shortDescAr: string;
  // Batch CAT — canonical taxonomy node id + a display label for the review.
  categoryId: string;
  categoryLabel: string;
  // Batch DISCOVERY-ENGINE — required, not optional. See the field's comment.
  region: string;
  storyAr: string;
  fundingGoalSar: string;
  releaseThresholdPct: string;
  durationDays: string;
  productSpecAr: string;
  expectedDeliveryDate: string;
}

const EMPTY: Draft = {
  titleAr: '',
  shortDescAr: '',
  categoryId: '',
  categoryLabel: '',
  region: '',
  storyAr: '',
  fundingGoalSar: '',
  releaseThresholdPct: '80',
  durationDays: '30',
  productSpecAr: '',
  expectedDeliveryDate: '',
};

function stepValid(s: StepId, d: Draft): boolean {
  switch (s) {
    case 'basics':
      return (
        d.titleAr.trim().length >= 4 &&
        d.shortDescAr.trim().length >= 8 &&
        d.categoryId.length > 0 &&
        d.region.length > 0
      );
    case 'story':
      // Create accepts ≥50 but /submit requires ≥200; gate the wizard at
      // 200 so users don't have to bounce twice.
      return d.storyAr.trim().length >= 200;
    case 'funding': {
      const goal = Number(d.fundingGoalSar);
      const pct = Number(d.releaseThresholdPct);
      const days = Number(d.durationDays);
      // 120 is the API's hard bound (project.dto.ts @Max(120)); the wizard used
      // to stop at 90 and block a duration the platform accepts.
      return goal >= 100 && pct >= 50 && pct <= 100 && days >= 7 && days <= 120;
    }
    case 'delivery':
      return true; // optional fields
    case 'review':
      return true;
  }
}

export function SubmissionWizard({
  initialError,
}: {
  initialError?: string;
}): React.ReactElement {
  const [stepIdx, setStepIdx] = useState(0);
  /**
   * Batch CONTENT — the creator must acknowledge the rules before submitting.
   * Deliberately NOT persisted in the Draft: this is an act, not a field, and it
   * is re-affirmed on every submission rather than remembered from a past one.
   */
  const [rulesAck, setRulesAck] = useState(false);
  const [d, setD] = useState<Draft>(EMPTY);
  const step = STEPS[stepIdx]!;
  const canAdvance = stepValid(step.id, d);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]): void =>
    setD((prev) => ({ ...prev, [k]: v }));

  return (
    <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <header>
        <h1
          style={{
            fontSize: 30,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 6,
          }}
        >
          أطلق مشروعك على وثبة
        </h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.65 }}>
          املأ {STEPS.length} خطوات سريعة. سيُنشأ المشروع كمسودّة ثم يُرسَل
          مباشرةً للمراجعة (5–7 أيام عادةً).
        </p>
      </header>

      <StepBar idx={stepIdx} />

      {initialError && (
        <ErrorBanner message={decodeURIComponent(initialError)} />
      )}

      <form action={submitProjectAction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* All step fields are mounted; only the visible one is editable. The
            unfocused ones still ride the form payload, so the server sees the
            full draft at submit time. */}
        <div hidden={step.id !== 'basics'}>
          <Field label="عنوان المشروع (4–120 حرف)">
            <input
              name="titleAr"
              value={d.titleAr}
              onChange={(e) => set('titleAr', e.target.value)}
              maxLength={120}
              style={inputStyle}
              placeholder="مثلاً: سِرب — درون التصوير الذكي"
            />
          </Field>
          <Field label="وصف مختصر (8–240 حرف)">
            <textarea
              name="shortDescAr"
              value={d.shortDescAr}
              onChange={(e) => set('shortDescAr', e.target.value)}
              maxLength={240}
              rows={2}
              style={inputStyle}
              placeholder="جملة أو اثنتين تشد القارئ من أول لحظة."
            />
          </Field>
          <Field label="الفئة (اختر فئة رئيسية ثم فرعية)">
            <input type="hidden" name="categoryId" value={d.categoryId} />
            <WathbaCategoryPicker
              value={d.categoryId}
              onSelect={(id, label) => {
                set('categoryId', id);
                set('categoryLabel', label);
              }}
            />
          </Field>
          {/*
            REQUIRED, deliberately — the API still accepts a project without one.
            It was optional here and nothing else in the product ever set it, so
            the location facet had 2% coverage and «قريبة منك» returned an empty
            list on every surface it appeared on. A filter nobody can populate is
            a filter that is always wrong; one required select at submission is
            what makes it true instead.
          */}
          <Field label="منطقة المشروع">
            <select
              name="region"
              value={d.region}
              onChange={(e) => set('region', e.target.value)}
              style={inputStyle}
            >
              <option value="">اختر المنطقة…</option>
              {REGIONS.map((r) => (
                <option key={r.key} value={r.key}>{r.ar}</option>
              ))}
            </select>
          </Field>
        </div>

        <div hidden={step.id !== 'story'}>
          <Field label="قصة المشروع (≥ 200 حرف — تُرسَل للمراجعة)">
            <textarea
              name="storyAr"
              value={d.storyAr}
              onChange={(e) => set('storyAr', e.target.value)}
              rows={10}
              style={inputStyle}
              placeholder="من أنتم؟ ما المشكلة؟ ليش المشروع؟ ماذا سيحصل عليه الداعم؟"
            />
            <Counter current={d.storyAr.length} min={200} max={5000} />
          </Field>
        </div>

        <div hidden={step.id !== 'funding'}>
          <Field label="هدف التمويل (ر.س)">
            <input
              name="fundingGoalSar"
              type="number"
              inputMode="numeric"
              value={d.fundingGoalSar}
              onChange={(e) => set('fundingGoalSar', e.target.value)}
              min={100}
              step={100}
              style={inputStyle}
              placeholder="مثلاً 400000"
            />
            <Hint>المبلغ المطلوب لإنتاج المشروع. يُحفَظ كهالة (هلل = 1/100 ر.س) في الـAPI.</Hint>
          </Field>
          <Field label="عتبة الإفراج (50–100٪)">
            <input
              name="releaseThresholdPct"
              type="number"
              inputMode="numeric"
              value={d.releaseThresholdPct}
              onChange={(e) => set('releaseThresholdPct', e.target.value)}
              min={50}
              max={100}
              style={inputStyle}
            />
            <Hint>
              نسبة الهدف اللي إذا وصلتوها يُسحب التمويل (الافتراضي 80٪). أقل من
              100 يفعّل تنبيه "الهدف الممتدّ" في صفحة المشروع.
            </Hint>
          </Field>
          <Field label="مدة الحملة (7–120 يوم)">
            <input
              name="durationDays"
              type="number"
              inputMode="numeric"
              value={d.durationDays}
              onChange={(e) => set('durationDays', e.target.value)}
              min={7}
              max={120}
              style={inputStyle}
            />
            {/*
              The cap was 90 — a number that matches nothing in the system. The
              API accepts 7–120 (project.dto.ts, and projects.service checks the
              live projects.durationHardMaxDays setting), and «قواعد المشاريع»
              §6 publishes exactly that. A creator entitled to 120 days was told
              by the published rules that they could ask for it and then found
              the form would not let them type it.

              The 60-day tier is stated here rather than only enforced: past it,
              approval REQUIRES an explicit approvedDurationDays grant
              (projects.ops duration-grant-required), so a creator who submits
              75 days with no idea a grant is needed stalls in review with
              nothing on screen explaining why.
            */}
            <Hint>
              حتى 60 يوماً تُعتمد مباشرة. من 61 إلى 120 يوماً تحتاج موافقة مسبقة من فريق
              وثبة مع سبب مكتوب — اذكر السبب في قصة المشروع.{' '}
              <a href="/rules/projects" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-ink)', fontWeight: 600 }}>
                قواعد المدة
              </a>
            </Hint>
          </Field>
        </div>

        <div hidden={step.id !== 'delivery'}>
          <Field label="مواصفات المنتج (اختياري)">
            <textarea
              name="productSpecAr"
              value={d.productSpecAr}
              onChange={(e) => set('productSpecAr', e.target.value)}
              rows={4}
              style={inputStyle}
              placeholder="أبعاد، مواد، ضمان، اعتماد… ما تحتاجوه يكون شفّاف للداعم."
            />
          </Field>
          <Field label="تاريخ التسليم المتوقّع (اختياري)">
            <input
              name="expectedDeliveryDate"
              type="date"
              value={d.expectedDeliveryDate}
              onChange={(e) => set('expectedDeliveryDate', e.target.value)}
              style={inputStyle}
            />
          </Field>
        </div>

        <div hidden={step.id !== 'review'}>
          <ReviewCard d={d} />

          {/* «لم أكن أعلم» is not a workable answer once backers' money is
              involved, so the rules are put in front of the creator at the last
              moment before submission — with the two pages that actually decide
              whether a project is accepted, one click away. */}
          <label
            data-testid="rules-ack"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              marginTop: 18,
              padding: '14px 16px',
              background: 'rgba(var(--accent-rgb),.06)',
              border: '1px solid rgba(var(--accent-rgb),.22)',
              borderRadius: 12,
              fontSize: 14.5,
              lineHeight: 1.85,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              name="rulesAck"
              checked={rulesAck}
              onChange={(e) => setRulesAck(e.target.checked)}
              style={{ marginTop: 5, width: 17, height: 17, accentColor: 'var(--accent)', flexShrink: 0 }}
            />
            <span>
              أقرّ بأنني قرأت{' '}
              <a href="/rules/projects" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-ink)', fontWeight: 600 }}>
                قواعد المشاريع
              </a>{' '}
              و
              <a href="/rules/prohibited" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-ink)', fontWeight: 600 }}>
                قائمة المواد والمشاريع المحظورة
              </a>
              ، وأن مشروعي لا يخالفها.
            </span>
          </label>
        </div>

        <nav
          style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'space-between',
            marginTop: 8,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            disabled={stepIdx === 0}
            style={btnGhost(stepIdx === 0)}
          >
            ← السابق
          </button>
          {stepIdx < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1))}
              disabled={!canAdvance}
              style={btnPrimary(!canAdvance)}
            >
              التالي →
            </button>
          ) : (
            <button type="submit" disabled={!rulesAck} style={btnPrimary(!rulesAck)}>
              إرسال للمراجعة
            </button>
          )}
        </nav>
      </form>
    </div>
  );
}

function StepBar({ idx }: { idx: number }): React.ReactElement {
  return (
    <ol
      style={{
        display: 'flex',
        gap: 8,
        listStyle: 'none',
        padding: 0,
        margin: 0,
        flexWrap: 'wrap',
      }}
    >
      {STEPS.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <li
            key={s.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
              padding: '6px 11px',
              borderRadius: 999,
              background: active
                ? 'rgba(var(--accent-rgb), 0.10)'
                : done
                  ? 'rgba(var(--accent-rgb), 0.06)'
                  : 'rgba(var(--ink-rgb), 0.06)',
              color: active ? 'var(--accent)' : done ? 'var(--text-soft)' : 'var(--muted)',
              border: active ? '1px solid rgba(var(--accent-rgb), 0.30)' : '1px solid transparent',
            }}
          >
            <span>{i + 1}</span>
            <span>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function ErrorBanner({ message }: { message: string }): React.ReactElement {
  return (
    <div
      role="alert"
      style={{
        background: 'rgba(var(--err-rgb), 0.08)',
        border: '1px solid rgba(var(--err-rgb), 0.30)',
        borderRadius: 11,
        padding: '10px 14px',
        fontSize: 13,
        color: 'var(--err, #dc2626)',
      }}
    >
      {message}
    </div>
  );
}

function ReviewCard({ d }: { d: Draft }): React.ReactElement {
  const cat = d.categoryLabel || '—';
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid rgba(var(--ink-rgb), 0.08)',
        borderRadius: 14,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{d.titleAr || '—'}</h2>
      <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>{d.shortDescAr || '—'}</p>
      <div style={{ display: 'flex', gap: 14, fontSize: 13, color: 'var(--text-soft)', flexWrap: 'wrap' }}>
        <span>الفئة: {cat}</span>
        <span>الهدف: {d.fundingGoalSar ? formatSar('ar', Number(d.fundingGoalSar)) : '—'}</span>
        <span>عتبة: {d.releaseThresholdPct || '80'}٪</span>
        <span>المدة: {d.durationDays || '—'} يوم</span>
        {d.expectedDeliveryDate && <span>التسليم المتوقّع: {d.expectedDeliveryDate}</span>}
      </div>
      {d.storyAr && (
        <details>
          <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--accent)' }}>
            مراجعة القصة ({d.storyAr.length} حرف)
          </summary>
          <p style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.75, color: 'var(--text)', marginTop: 6 }}>
            {d.storyAr}
          </p>
        </details>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{label}</span>
      {children}
    </label>
  );
}

function Hint({ children }: { children: React.ReactNode }): React.ReactElement {
  return <span style={{ fontSize: 12, color: 'var(--muted)' }}>{children}</span>;
}

function Counter({ current, min, max }: { current: number; min: number; max: number }): React.ReactElement {
  const ok = current >= min && current <= max;
  return (
    <span style={{ fontSize: 12, color: ok ? 'var(--muted)' : 'var(--err, #dc2626)' }}>
      {current} حرف · يحتاج بين {min} و {max}
    </span>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 10,
  border: '1px solid rgba(var(--ink-rgb), 0.16)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: 14,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

function btnPrimary(disabled: boolean): React.CSSProperties {
  return {
    background: 'var(--grad)',
    color: 'var(--on-accent)',
    fontFamily: 'inherit',
    fontWeight: 700,
    fontSize: 14,
    padding: '10px 18px',
    borderRadius: 11,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
}

function btnGhost(disabled: boolean): React.CSSProperties {
  return {
    background: 'transparent',
    color: 'var(--text)',
    border: '1px solid rgba(var(--ink-rgb), 0.16)',
    fontFamily: 'inherit',
    fontWeight: 700,
    fontSize: 14,
    padding: '10px 18px',
    borderRadius: 11,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
}
