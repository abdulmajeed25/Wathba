'use client';

/**
 * Wathba (وثبة) — START PROJECT (launch wizard).
 *
 * 1:1 port of WATBHوثبة.dc.html lines 835–942. Every pixel, hex, gradient,
 * radius, padding and Arabic string is lifted verbatim from the design.
 * The wizard's behavior (5 steps, gradient progress circles, last-step
 * publish label "أطلق المشروع 🚀") mirrors the design's `state.startStep` +
 * `startStepsView` derivation block (HTML lines 1447–1707).
 *
 * On the final "publish" click we POST to /v1/ventures (apps/api's
 * SubmitIdeaDto). Fields the design collects but the API doesn't accept
 * (campaignDays, story text, media, reward tiers) are dropped client-side
 * for now and folded into `data` as a JSON blob — the vetting council
 * sees the full payload when reviewing the submission.
 */

import { useRouter } from 'next/navigation';
import {
  type CSSProperties,
  type ChangeEvent,
  type ReactNode,
  useMemo,
  useState,
} from 'react';

import { api } from '@/lib/api/client';

import { wathbaCategories } from './wathba-data';
import { Icon, Num } from './wathba-icons';

// ── Step rail (design lines 1447–1453, rendered 842–851) ───────────────────
interface StepDef {
  n: number;
  label: string;
  icon: string;
}
const STEPS: readonly StepDef[] = [
  { n: 1, label: 'الأساسيات', icon: 'edit_note' },
  { n: 2, label: 'التمويل', icon: 'payments' },
  { n: 3, label: 'القصة', icon: 'auto_stories' },
  { n: 4, label: 'المكافآت', icon: 'redeem' },
  { n: 5, label: 'المراجعة', icon: 'rocket_launch' },
];

// ── Default reward tiers (design lines 906–911, "tiers" placeholder count 3)
interface DraftTier {
  id: string;
  price: string; // raw text, e.g. "$25"
  title: string;
  desc: string;
}
const DEFAULT_TIERS: DraftTier[] = [
  { id: 'dt0', price: '$25', title: 'داعم مبكر', desc: 'شارة + تحديثات حصرية' },
  { id: 'dt1', price: '$79', title: 'الباقة الأساسية', desc: 'وحدة + شحن مجاني' },
  { id: 'dt2', price: '$149', title: 'الباقة المزدوجة', desc: 'وحدتان + إكسسوارات' },
];

// ── Step 2: number sanitiser (strip commas, parse int) ─────────────────────
function parseAmount(s: string): number {
  const cleaned = s.replace(/[^\d.]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// ── Step 1 → slug. The API enforces SLUG_REGEX (lowercase a-z0-9 + hyphens).
function slugify(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return '';
  // Hash Arabic titles into a deterministic slug; latin titles get kebab-case.
  const latin = trimmed
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  if (latin.length >= 3) return latin.slice(0, 60);
  // Arabic fallback: a stable 10-char hash so the slug is deterministic.
  let h = 5381;
  for (let i = 0; i < trimmed.length; i++) h = (h * 33) ^ trimmed.charCodeAt(i);
  return 'venture-' + (h >>> 0).toString(36).slice(0, 10);
}

export function WathbaStart() {
  const router = useRouter();
  const [step, setStep] = useState<number>(1);

  // form state — all steps preserved across navigation
  const [title, setTitle] = useState<string>('');
  const [tagline, setTagline] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [goalText, setGoalText] = useState<string>('400,000');
  const [durationText, setDurationText] = useState<string>('30');
  const [story, setStory] = useState<string>('');
  const [mediaName, setMediaName] = useState<string>('');
  const [tiers, setTiers] = useState<DraftTier[]>(DEFAULT_TIERS);
  const [editingTier, setEditingTier] = useState<string | null>(null);

  // submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isLast = step === STEPS.length;
  const canBack = step > 1;
  const nextLabel = isLast ? 'أطلق المشروع 🚀' : 'متابعة';

  const selectedCategory = useMemo(
    () => wathbaCategories.find((c) => c.id === categoryId) ?? null,
    [categoryId],
  );

  const handlePublish = async (): Promise<void> => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const fundingGoal = parseAmount(goalText);
      const campaignDays = parseAmount(durationText);
      await api('/v1/ventures', {
        method: 'POST',
        body: {
          title: (title || 'مشروع جديد على وثبة').slice(0, 160),
          slug: slugify(title) || slugify('venture-' + Date.now()),
          tagline: tagline || undefined,
          // sectorId stays undefined — design's category chips are pillar
          // labels, not platform sector UUIDs. Council reviewers map them
          // post-submit. Full payload travels in `data`.
          data: {
            categoryId: categoryId || null,
            categoryLabel: selectedCategory?.ar ?? null,
            campaignDays,
            story,
            mediaPlaceholder: mediaName || null,
            tiers,
          },
          willingToLead: true,
          fundingGoal,
          fundingCurrency: 'SAR',
        },
      });
      router.push('/projects/dashboard');
    } catch (err) {
      setSubmitError(
        err instanceof Error && err.message ? err.message : 'تعذّر إرسال المشروع — حاول مجدداً.',
      );
      setSubmitting(false);
    }
  };

  const handleNext = (): void => {
    if (isLast) {
      void handlePublish();
      return;
    }
    setStep((s) => Math.min(STEPS.length, s + 1));
  };

  const handleBack = (): void => setStep((s) => Math.max(1, s - 1));

  return (
    <div className="wathba-fade">
      {/* ── HEADER + STEP RAIL (design 837–852) ─────────────────────────── */}
      <section style={{ maxWidth: 980, margin: '0 auto', padding: '40px 26px 0' }}>
        <Num
          style={{
            display: 'block',
            fontSize: 12,
            letterSpacing: '2px',
            color: 'var(--accent)',
            marginBottom: 8,
          }}
        >
          START A PROJECT
        </Num>
        <h1
          style={{
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: '-.7px',
            marginBottom: 8,
          }}
        >
          أطلق مشروعك على وثبة
        </h1>
        <p style={{ fontSize: 15, color: 'var(--muted)', marginBottom: 32 }}>
          خمس خطوات تفصلك عن تحويل فكرتك إلى حملة تمويل ناجحة.
        </p>

        <nav
          aria-label="مراحل إطلاق المشروع"
          style={{ display: 'flex', alignItems: 'center', marginBottom: 38 }}
        >
          {STEPS.map((s, i) => {
            const reached = step >= s.n;
            const isLastInRail = i === STEPS.length - 1;
            return (
              <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <button
                  type="button"
                  onClick={() => setStep(s.n)}
                  data-step={s.n}
                  data-active={step === s.n ? 'true' : 'false'}
                  data-reached={reached ? 'true' : 'false'}
                  style={{
                    appearance: 'none',
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    fontFamily: 'inherit',
                  }}
                >
                  <span
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 14,
                      background: reached
                        ? 'var(--grad)'
                        : 'rgba(var(--ink-rgb),.06)',
                      color: reached ? 'var(--on-accent)' : 'var(--muted2)',
                      display: 'grid',
                      placeItems: 'center',
                      transition: 'all .3s',
                    }}
                  >
                    <Icon name={s.icon} size={23} />
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: reached ? 'var(--text)' : 'var(--muted2)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.label}
                  </span>
                </button>
                {!isLastInRail && (
                  <span
                    aria-hidden="true"
                    style={{
                      flex: 1,
                      height: 2,
                      background: 'rgba(var(--ink-rgb),.1)',
                      margin: '0 10px 24px',
                    }}
                  />
                )}
              </div>
            );
          })}
        </nav>
      </section>

      {/* ── WIZARD CARD (design 854–940) ─────────────────────────────────── */}
      <section style={{ maxWidth: 980, margin: '0 auto', padding: '0 26px 10px' }}>
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid rgba(var(--ink-rgb),.09)',
            borderRadius: 20,
            padding: 32,
          }}
        >
          {step === 1 && (
            <StepBasics
              title={title}
              tagline={tagline}
              categoryId={categoryId}
              onTitle={setTitle}
              onTagline={setTagline}
              onCategory={setCategoryId}
            />
          )}
          {step === 2 && (
            <StepFunding
              goalText={goalText}
              durationText={durationText}
              onGoal={setGoalText}
              onDuration={setDurationText}
            />
          )}
          {step === 3 && (
            <StepStory
              story={story}
              mediaName={mediaName}
              onStory={setStory}
              onMedia={setMediaName}
            />
          )}
          {step === 4 && (
            <StepTiers
              tiers={tiers}
              editingId={editingTier}
              onEdit={setEditingTier}
              onChange={setTiers}
            />
          )}
          {step === 5 && (
            <StepReview
              title={title}
              categoryLabel={selectedCategory?.ar ?? 'تقنية'}
              goalText={goalText}
              durationText={durationText}
              submitError={submitError}
            />
          )}

          {/* ── PREV / NEXT BAR (design 933–938) ───────────────────────── */}
          <div
            style={{
              display: 'flex',
              gap: 12,
              marginTop: 28,
              paddingTop: 24,
              borderTop: '1px solid rgba(var(--ink-rgb),.08)',
            }}
          >
            {canBack && (
              <button
                type="button"
                onClick={handleBack}
                disabled={submitting}
                className="btng"
                style={{
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  background: 'transparent',
                  border: '1px solid rgba(var(--ink-rgb),.16)',
                  color: 'var(--muted)',
                  fontWeight: 600,
                  fontSize: 15,
                  padding: '14px 26px',
                  borderRadius: 13,
                  fontFamily: 'inherit',
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                رجوع
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              disabled={submitting}
              className="btnp"
              style={{
                flex: 1,
                border: 'none',
                cursor: submitting ? 'not-allowed' : 'pointer',
                background: 'var(--grad)',
                color: 'var(--on-accent)',
                fontWeight: 700,
                fontSize: 15,
                padding: 14,
                borderRadius: 13,
                fontFamily: 'inherit',
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'جارٍ النشر…' : nextLabel}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// STEP 1 — basics (design 857–870)
// ─────────────────────────────────────────────────────────────────────────
function StepBasics({
  title,
  tagline,
  categoryId,
  onTitle,
  onTagline,
  onCategory,
}: {
  title: string;
  tagline: string;
  categoryId: string;
  onTitle: (v: string) => void;
  onTagline: (v: string) => void;
  onCategory: (v: string) => void;
}) {
  return (
    <div className="wathba-fade">
      <h2 style={{ fontSize: 21, fontWeight: 700, marginBottom: 6 }}>أساسيات المشروع</h2>
      <p style={{ fontSize: 13.5, color: 'var(--muted2)', marginBottom: 24 }}>
        ابدأ بالاسم والفئة — هذه أول ما يراه الداعمون.
      </p>

      <Field label="عنوان المشروع">
        <input
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          placeholder="مثال: سِرب — درون التصوير الذكي"
          style={inputStyle}
        />
      </Field>

      <Field label="الوصف المختصر">
        <input
          value={tagline}
          onChange={(e) => onTagline(e.target.value)}
          placeholder="جملة واحدة تلخّص مشروعك"
          style={inputStyle}
        />
      </Field>

      <label style={{ ...labelStyle, marginBottom: 10 }}>الفئة</label>
      <div
        role="radiogroup"
        aria-label="فئة المشروع"
        style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}
      >
        {wathbaCategories.map((c) => {
          const active = categoryId === c.id;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onCategory(c.id)}
              className="chip"
              style={{
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 13.5,
                fontWeight: 600,
                padding: '10px 16px',
                borderRadius: 30,
                background: active
                  ? 'rgba(var(--accent-rgb),.12)'
                  : 'rgba(var(--ink-rgb),.04)',
                color: active ? 'var(--text)' : 'var(--muted)',
                border: active
                  ? '1px solid rgba(var(--accent-rgb),.4)'
                  : '1px solid rgba(var(--ink-rgb),.1)',
                fontFamily: 'inherit',
              }}
            >
              <Icon name={c.icon} size={17} />
              {c.ar}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// STEP 2 — funding (design 872–885)
// ─────────────────────────────────────────────────────────────────────────
function StepFunding({
  goalText,
  durationText,
  onGoal,
  onDuration,
}: {
  goalText: string;
  durationText: string;
  onGoal: (v: string) => void;
  onDuration: (v: string) => void;
}) {
  return (
    <div className="wathba-fade">
      <h2 style={{ fontSize: 21, fontWeight: 700, marginBottom: 6 }}>هدف التمويل</h2>
      <p style={{ fontSize: 13.5, color: 'var(--muted2)', marginBottom: 24 }}>
        حدّد مبلغاً واقعياً يغطّي تكاليف تنفيذ مشروعك.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 18,
          marginBottom: 24,
        }}
      >
        <div>
          <label style={labelStyle}>هدف التمويل (بالدولار)</label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(var(--ink-rgb),.04)',
              border: '1px solid rgba(var(--ink-rgb),.12)',
              borderRadius: 12,
              padding: '0 14px',
            }}
          >
            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>$</span>
            <input
              aria-label="هدف التمويل"
              value={goalText}
              onChange={(e) => onGoal(e.target.value)}
              className="num"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                padding: '14px 8px',
                color: 'var(--text)',
                fontSize: 18,
                fontWeight: 700,
                fontFamily: '"Space Grotesk", sans-serif',
                outline: 'none',
              }}
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>مدة الحملة (يوم)</label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(var(--ink-rgb),.04)',
              border: '1px solid rgba(var(--ink-rgb),.12)',
              borderRadius: 12,
              padding: '0 14px',
            }}
          >
            <input
              aria-label="مدة الحملة"
              value={durationText}
              onChange={(e) => onDuration(e.target.value)}
              className="num"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                padding: '14px 8px',
                color: 'var(--text)',
                fontSize: 18,
                fontWeight: 700,
                fontFamily: '"Space Grotesk", sans-serif',
                outline: 'none',
              }}
            />
            <span style={{ color: 'var(--muted2)', fontSize: 13 }}>يوم</span>
          </div>
        </div>
      </div>

      <div
        style={{
          background: 'rgba(var(--accent-rgb),.05)',
          border: '1px solid rgba(var(--accent-rgb),.18)',
          borderRadius: 14,
          padding: 18,
          display: 'flex',
          gap: 14,
        }}
      >
        <Icon name="tips_and_updates" size={24} color="var(--accent)" style={{ flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 5 }}>
            نموذج «الكل أو لا شيء»
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--muted)' }}>
            لن تتلقى أي تمويل إلا إذا بلغت هدفك خلال المدة المحددة. هذا يبني الثقة مع الداعمين
            ويحميهم.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// STEP 3 — story + media upload placeholder (design 887–899)
// ─────────────────────────────────────────────────────────────────────────
function StepStory({
  story,
  mediaName,
  onStory,
  onMedia,
}: {
  story: string;
  mediaName: string;
  onStory: (v: string) => void;
  onMedia: (v: string) => void;
}) {
  const onFile = (e: ChangeEvent<HTMLInputElement>): void => {
    const f = e.target.files?.[0];
    onMedia(f?.name ?? '');
  };
  return (
    <div className="wathba-fade">
      <h2 style={{ fontSize: 21, fontWeight: 700, marginBottom: 6 }}>القصة والوسائط</h2>
      <p style={{ fontSize: 13.5, color: 'var(--muted2)', marginBottom: 24 }}>
        المشاريع ذات الفيديو تجمع تمويلاً أكثر بنسبة ٨٥٪.
      </p>

      <label
        className="btng"
        style={{
          display: 'block',
          border: '2px dashed rgba(var(--ink-rgb),.15)',
          borderRadius: 16,
          padding: 36,
          textAlign: 'center',
          marginBottom: 20,
          cursor: 'pointer',
        }}
      >
        <input
          type="file"
          accept="video/mp4,image/png,image/jpeg"
          onChange={onFile}
          style={{ display: 'none' }}
          aria-label="رفع وسائط المشروع"
        />
        <Icon name="cloud_upload" size={40} color="var(--accent)" />
        <div style={{ fontSize: 15, fontWeight: 600, marginTop: 12 }}>
          {mediaName ? mediaName : 'اسحب فيديو أو صور المشروع هنا'}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--muted2)', marginTop: 5 }}>
          MP4، PNG، JPG — حتى 200MB
        </div>
      </label>

      <label style={labelStyle}>قصة المشروع</label>
      <textarea
        value={story}
        onChange={(e) => onStory(e.target.value)}
        placeholder="احكِ قصتك: ما المشكلة التي تحلّها؟ من أنت؟ لماذا الآن؟"
        style={{
          width: '100%',
          minHeight: 140,
          background: 'rgba(var(--ink-rgb),.04)',
          border: '1px solid rgba(var(--ink-rgb),.12)',
          borderRadius: 12,
          padding: 14,
          color: 'var(--text)',
          fontSize: 14.5,
          lineHeight: 1.7,
          resize: 'vertical',
          fontFamily: 'inherit',
          outline: 'none',
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// STEP 4 — reward tiers (design 901–913)
// ─────────────────────────────────────────────────────────────────────────
function StepTiers({
  tiers,
  editingId,
  onEdit,
  onChange,
}: {
  tiers: DraftTier[];
  editingId: string | null;
  onEdit: (id: string | null) => void;
  onChange: (next: DraftTier[]) => void;
}) {
  const update = (id: string, patch: Partial<DraftTier>): void => {
    onChange(tiers.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };
  const addTier = (): void => {
    const id = 'dt-' + Date.now().toString(36);
    onChange([...tiers, { id, price: '$0', title: 'مستوى جديد', desc: '' }]);
    onEdit(id);
  };

  return (
    <div className="wathba-fade">
      <h2 style={{ fontSize: 21, fontWeight: 700, marginBottom: 6 }}>مستويات المكافآت</h2>
      <p style={{ fontSize: 13.5, color: 'var(--muted2)', marginBottom: 24 }}>
        امنح داعميك أسباباً للمشاركة على مستويات مختلفة.
      </p>

      {tiers.map((t) => {
        const editing = editingId === t.id;
        return (
          <div
            key={t.id}
            style={{
              background: 'rgba(var(--ink-rgb),.03)',
              border: '1px solid rgba(var(--ink-rgb),.1)',
              borderRadius: 14,
              padding: 18,
              marginBottom: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <Num
              style={{
                width: 64,
                height: 64,
                borderRadius: 13,
                background: 'rgba(var(--accent-rgb),.1)',
                color: 'var(--accent)',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              {editing ? (
                <input
                  aria-label="سعر المكافأة"
                  value={t.price}
                  onChange={(e) => update(t.id, { price: e.target.value })}
                  className="num"
                  style={{
                    width: 56,
                    background: 'transparent',
                    border: 'none',
                    textAlign: 'center',
                    color: 'var(--accent)',
                    fontWeight: 700,
                    fontSize: 16,
                    fontFamily: '"Space Grotesk", sans-serif',
                    outline: 'none',
                  }}
                />
              ) : (
                t.price
              )}
            </Num>
            <div style={{ flex: 1 }}>
              {editing ? (
                <>
                  <input
                    aria-label="عنوان المكافأة"
                    value={t.title}
                    onChange={(e) => update(t.id, { title: e.target.value })}
                    style={{ ...inputStyle, marginBottom: 6, padding: '8px 10px', fontSize: 14 }}
                  />
                  <input
                    aria-label="وصف المكافأة"
                    value={t.desc}
                    onChange={(e) => update(t.id, { desc: e.target.value })}
                    style={{ ...inputStyle, padding: '8px 10px', fontSize: 13 }}
                  />
                </>
              ) : (
                <>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 3 }}>{t.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>{t.desc}</div>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => onEdit(editing ? null : t.id)}
              aria-label={editing ? 'حفظ المكافأة' : 'تعديل المكافأة'}
              style={{
                appearance: 'none',
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
              }}
            >
              <Icon name={editing ? 'check' : 'edit'} size={20} color="var(--muted2)" />
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addTier}
        className="btng"
        style={{
          width: '100%',
          background: 'transparent',
          border: '1.5px dashed rgba(var(--accent-rgb),.3)',
          borderRadius: 14,
          padding: 16,
          textAlign: 'center',
          cursor: 'pointer',
          color: 'var(--accent)',
          fontWeight: 600,
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          fontFamily: 'inherit',
        }}
      >
        <Icon name="add_circle" size={20} />
        أضف مستوى مكافأة جديد
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// STEP 5 — review (design 916–931)
// ─────────────────────────────────────────────────────────────────────────
function StepReview({
  title,
  categoryLabel,
  goalText,
  durationText,
  submitError,
}: {
  title: string;
  categoryLabel: string;
  goalText: string;
  durationText: string;
  submitError: string | null;
}) {
  const goalNum = parseAmount(goalText);
  const durationNum = parseAmount(durationText);
  const cards = [
    { label: 'العنوان', value: title || 'سِرب — درون التصوير الذكي', accent: false },
    { label: 'الفئة', value: categoryLabel, accent: false },
    {
      label: 'الهدف',
      value: '$' + goalNum.toLocaleString('en-US'),
      accent: true,
    },
    { label: 'المدة', value: `${durationNum.toLocaleString('en-US')} يوم`, accent: false },
  ];
  return (
    <div className="wathba-fade">
      <h2 style={{ fontSize: 21, fontWeight: 700, marginBottom: 6 }}>مراجعة وإطلاق</h2>
      <p style={{ fontSize: 13.5, color: 'var(--muted2)', marginBottom: 24 }}>
        راجع التفاصيل النهائية قبل الإطلاق.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 14,
          marginBottom: 18,
        }}
      >
        {cards.map((c) => (
          <div
            key={c.label}
            style={{
              background: 'rgba(var(--ink-rgb),.03)',
              border: '1px solid rgba(var(--ink-rgb),.08)',
              borderRadius: 13,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 5 }}>{c.label}</div>
            {c.accent ? (
              <Num style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>
                {c.value}
              </Num>
            ) : (
              <div style={{ fontSize: 15, fontWeight: 700 }}>{c.value}</div>
            )}
          </div>
        ))}
      </div>
      <div
        style={{
          background:
            'linear-gradient(120deg,rgba(var(--accent2-rgb),.12),rgba(var(--accent-rgb),.12))',
          border: '1px solid rgba(var(--accent-rgb),.25)',
          borderRadius: 14,
          padding: 18,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <Icon name="check_circle" size={28} color="var(--pos)" />
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>مشروعك جاهز للإطلاق!</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            سيخضع لمراجعة سريعة خلال ٢٤ ساعة قبل النشر.
          </div>
        </div>
      </div>
      {submitError && (
        <div
          role="alert"
          style={{
            marginTop: 14,
            background: 'rgba(220,38,38,.08)',
            border: '1px solid rgba(220,38,38,.3)',
            borderRadius: 12,
            padding: 14,
            color: '#dc2626',
            fontSize: 13.5,
            fontWeight: 600,
          }}
        >
          {submitError}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Shared field shell + token styles
// ─────────────────────────────────────────────────────────────────────────
const labelStyle: CSSProperties = {
  fontSize: 13.5,
  color: 'var(--text-soft)',
  display: 'block',
  marginBottom: 8,
  fontWeight: 600,
};

const inputStyle: CSSProperties = {
  width: '100%',
  background: 'rgba(var(--ink-rgb),.04)',
  border: '1px solid rgba(var(--ink-rgb),.12)',
  borderRadius: 12,
  padding: 14,
  color: 'var(--text)',
  fontSize: 15,
  fontFamily: 'inherit',
  outline: 'none',
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}
