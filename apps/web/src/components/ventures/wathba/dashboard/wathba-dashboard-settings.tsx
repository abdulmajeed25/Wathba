'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { ApiProjectDetail } from '@/lib/api/wathba';
import { WathbaDashboardCollaborators } from './wathba-dashboard-collaborators';
import { WathbaTagPicker } from './wathba-tag-picker';
import { useConfirm } from '../wathba-feedback';
import { formatSarFromHalalas } from '@/lib/i18n/format';

/* ─────── Static enums + labels ──────────────────────────────────────────────
 * Kept colocated so we don't drag the @prisma/client enum into the browser
 * bundle. Mirrors apps/api/prisma/schema.prisma's ProjectCategory enum.
 */
const CATEGORIES: ReadonlyArray<{ value: string; labelAr: string }> = [
  { value: 'TECH', labelAr: 'تقنية' },
  { value: 'DESIGN', labelAr: 'تصميم' },
  { value: 'FILM', labelAr: 'أفلام' },
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
  PAUSED: 'موقوفة مؤقتاً',
  SUCCESSFUL: 'ناجح',
  FAILED: 'متعثّر',
  FUNDED: 'مموَّل',
  IN_PRODUCTION: 'قيد التصنيع',
  DELIVERED: 'مُسلَّم',
  REFUNDED: 'مُعاد',
};

const STATUS_COLORS: Readonly<Record<string, string>> = {
  DRAFT: '#6b7280',
  UNDER_REVIEW: 'var(--gold-ink)',
  LIVE: 'var(--pos-ink)',
  PAUSED: 'var(--gold-ink)',
  SUCCESSFUL: 'var(--pos-ink)',
  FUNDED: 'var(--pos-ink)',
  IN_PRODUCTION: 'var(--purple-ink)',
  DELIVERED: 'var(--purple-ink)',
  FAILED: 'var(--err)',
  REFUNDED: 'var(--err)',
};

const fmtSAR = (h: number): string => formatSarFromHalalas('ar', h);

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
  const confirmDlg = useConfirm();
  const [shortDescAr, setShortDescAr] = useState(project.shortDescAr);
  const [category, setCategory] = useState(project.category);

  // ── Funding form ─────────────────────────────────────────────────────────
  const [goalSAR, setGoalSAR] = useState((project.fundingGoalHalalas / 100).toString());
  const [threshold, setThreshold] = useState(project.releaseThresholdPct);
  // CC-15 — duration is editable pre-launch only; the deadline is derived from
  // it at publish and locked afterwards (policy §1: no post-launch extension).
  const [durationDays, setDurationDays] = useState(project.durationDays);

  // ── CC-22 SEO + CC-20 scheduled launch (pre-launch only) ─────────────────
  const [slug, setSlug] = useState(project.slug ?? '');
  const [ogImage, setOgImage] = useState(project.ogImage ?? '');
  const [metaDescription, setMetaDescription] = useState(project.metaDescription ?? '');
  const [scheduledLaunchAt, setScheduledLaunchAt] = useState(
    project.scheduledLaunchAt ? project.scheduledLaunchAt.slice(0, 16) : '',
  );
  const [seoBusy, setSeoBusy] = useState(false);
  const [seoMsg, setSeoMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const saveSeo = async (): Promise<void> => {
    setSeoBusy(true);
    setSeoMsg(null);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug: slug.trim() || null,
          ogImage: ogImage.trim() || null,
          metaDescription: metaDescription.trim() || null,
          scheduledLaunchAt: scheduledLaunchAt ? new Date(scheduledLaunchAt).toISOString() : null,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string | string[] };
      if (!res.ok) {
        setSeoMsg({ kind: 'err', text: Array.isArray(j.message) ? j.message.join('، ') : (j.message ?? 'تعذّر الحفظ') });
        return;
      }
      setSeoMsg({ kind: 'ok', text: 'تم الحفظ' });
      router.refresh();
    } catch {
      setSeoMsg({ kind: 'err', text: 'خطأ في الاتصال' });
    } finally {
      setSeoBusy(false);
    }
  };

  /**
   * Stage 1 item 12 — the campaign video.
   *
   * This control is why the field is worth having. Before it, `videoUrl` could
   * only ever be set by someone with database or API access, and a card feature
   * that no creator can feed is a feature that never runs.
   *
   * kind: 'story' rather than a new upload kind. media.service already accepts
   * video/mp4 and video/webm under `story` at 25MB, and its `story/` prefix is
   * already in the bucket's public-read policy. Adding a `video` kind would
   * have meant widening that policy for a path with one producer — the module's
   * own comment records that exact mistake being made before.
   */
  const [videoUrl, setVideoUrl] = useState(project.videoUrl ?? '');
  const [vidBusy, setVidBusy] = useState(false);
  const [vidMsg, setVidMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  /**
   * What the CARD shows — migration 0060.
   *
   * Only offered once a video exists, because with no video the question has no
   * meaning: the card is the cover either way. VIDEO is the stored default, so
   * uploading a clip turns hover-play on and this control is how a creator
   * turns it back off without deleting the clip — which would also remove it
   * from the campaign page.
   */
  const [cardMedia, setCardMedia] = useState<'VIDEO' | 'POSTER'>(project.cardMedia ?? 'VIDEO');

  const patchProject = async (body: Record<string, unknown>): Promise<void> => {
    const res = await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    if (!res.ok) {
      throw new Error(Array.isArray(j.message) ? j.message.join('، ') : (j.message ?? 'تعذّر الحفظ'));
    }
  };

  const saveVideoUrl = (next: string | null): Promise<void> => patchProject({ videoUrl: next });

  const saveCardMedia = async (next: 'VIDEO' | 'POSTER'): Promise<void> => {
    const prev = cardMedia;
    // Optimistic, then reverted on failure: this is a two-state toggle and a
    // control that waits on a round trip to move reads as broken.
    setCardMedia(next);
    setVidBusy(true);
    setVidMsg(null);
    try {
      await patchProject({ cardMedia: next });
      setVidMsg({
        kind: 'ok',
        text: next === 'VIDEO' ? 'ستعرض البطاقة الفيديو عند مرور المؤشر' : 'ستعرض البطاقة الصورة فقط',
      });
      router.refresh();
    } catch (e) {
      setCardMedia(prev);
      setVidMsg({ kind: 'err', text: e instanceof Error ? e.message : 'تعذّر الحفظ' });
    } finally {
      setVidBusy(false);
    }
  };

  const uploadVideo = async (file: File): Promise<void> => {
    setVidBusy(true);
    setVidMsg(null);
    try {
      const presign = await fetch('/api/media/upload-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          kind: 'story',
          mimeType: file.type || 'video/mp4',
          sizeBytes: file.size,
        }),
      });
      if (!presign.ok) {
        throw new Error(`فشل توقيع الرفع (${presign.status})`);
      }
      const { url, publicUrl } = (await presign.json()) as { url: string; publicUrl: string };
      const put = await fetch(url, {
        method: 'PUT',
        headers: { 'content-type': file.type || 'video/mp4' },
        body: file,
      });
      if (!put.ok) throw new Error(`فشل الرفع (${put.status})`);
      await saveVideoUrl(publicUrl);
      setVideoUrl(publicUrl);
      setVidMsg({ kind: 'ok', text: 'تم رفع الفيديو' });
      router.refresh();
    } catch (e) {
      setVidMsg({ kind: 'err', text: e instanceof Error ? e.message : 'تعذّر الرفع' });
    } finally {
      setVidBusy(false);
    }
  };

  const removeVideo = async (): Promise<void> => {
    setVidBusy(true);
    setVidMsg(null);
    try {
      await saveVideoUrl(null);
      setVideoUrl('');
      setVidMsg({ kind: 'ok', text: 'تم حذف الفيديو' });
      router.refresh();
    } catch (e) {
      setVidMsg({ kind: 'err', text: e instanceof Error ? e.message : 'تعذّر الحذف' });
    } finally {
      setVidBusy(false);
    }
  };

  // ── CC-21 duplicate ──────────────────────────────────────────────────────
  const [dupBusy, setDupBusy] = useState(false);
  const duplicate = async (): Promise<void> => {
    setDupBusy(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/duplicate`, { method: 'POST' });
      if (res.ok) {
        const j = (await res.json()) as { id: string };
        router.push(`/projects/dashboard/${j.id}/settings`);
      }
    } finally {
      setDupBusy(false);
    }
  };

  // ── Lifecycle actions (CC-14 pause/unpause, CC-09 deliver) ───────────────
  const [actionBusy, setActionBusy] = useState<'pause' | 'unpause' | 'deliver' | null>(null);
  const [actionMsg, setActionMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const doAction = async (
    kind: 'pause' | 'unpause' | 'deliver',
    okText: string,
  ): Promise<void> => {
    setActionBusy(kind);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/${kind}`, { method: 'POST' });
      const j = (await res.json().catch(() => ({}))) as { message?: string | string[] };
      if (!res.ok) {
        setActionMsg({
          kind: 'err',
          text: Array.isArray(j.message) ? j.message.join('، ') : (j.message ?? 'تعذّر التنفيذ'),
        });
        return;
      }
      setActionMsg({ kind: 'ok', text: okText });
      router.refresh();
    } catch {
      setActionMsg({ kind: 'err', text: 'خطأ في الاتصال — أعد المحاولة.' });
    } finally {
      setActionBusy(null);
    }
  };

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
      // CC-15 — duration editable only pre-launch (server also gates this).
      ...(editable ? { durationDays } : {}),
    });
  };

  const submitForReview = async (): Promise<void> => {
    if (
      !(await confirmDlg({
        title: 'إرسال الحملة للمراجعة؟',
        body: 'سيتمّ إرسال الحملة لمراجعة الإدارة، ولن تتمكّن من تعديل البيانات الأساسية أثناء المراجعة.',
        confirmLabel: 'إرسال للمراجعة',
      }))
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

        {editable ? (
          <Field label="مدّة الحملة (أيام)">
            {/* Was capped at 90 here too — the same bound the submission wizard
                had, and the same mismatch: the API accepts 7–120 and «قواعد
                المشاريع» §6 publishes that range. Editing a draft must not be
                able to refuse a duration the platform grants. */}
            <input
              type="number"
              min={7}
              max={120}
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value))}
              disabled={!editable}
              style={inputStyle(editable)}
            />
            <Hint>
              بين ٧ و١٢٠ يوماً — حتى ٦٠ تُعتمد مباشرة، وما فوقها يحتاج موافقة مسبقة من
              فريق وثبة. يُحتسب الموعد النهائي تلقائياً من المدّة عند نشر الحملة.
              بعد النشر يُقفل الموعد ولا يمكن تمديده (سياسة §١).
            </Hint>
          </Field>
        ) : (
          <>
            <ReadOnlyRow label="مدّة الحملة" value={`${project.durationDays} يوماً`} />
            <ReadOnlyRow label="الموعد النهائي" value={deadlineFmt} />
            <Hint>الموعد النهائي مقفل بعد النشر — لا يمكن تمديده (سياسة §١).</Hint>
          </>
        )}

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

        {/* CC-04 — admin rejection feedback, surfaced after a review sends the
            project back to DRAFT with a note. */}
        {project.status === 'DRAFT' && project.reviewFeedback && (
          <div
            style={{
              margin: '12px 0 4px',
              padding: '14px 16px',
              borderRadius: 12,
              border: '1px solid rgba(245,158,11,0.45)',
              background: 'rgba(245,158,11,0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>📝</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold-ink)' }}>
                طلب تعديلات من فريق المراجعة
              </span>
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--text-primary, var(--text-primary))', margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>
              {project.reviewFeedback}
            </p>
            <a
              href={`/projects/dashboard/${project.id}/story`}
              style={{
                display: 'inline-block', fontSize: 13, fontWeight: 700,
                padding: '8px 16px', borderRadius: 10, textDecoration: 'none',
                color: 'var(--on-brand, #08130d)', background: 'var(--brand-primary, #05a661)',
              }}
            >
              عدّل وأعد الإرسال ←
            </a>
          </div>
        )}

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
          <>
            <Hint>
              الحملة منشورة ومفعّلة. يمكنك إيقافها مؤقتاً لتجميد الدعم الجديد — دون
              تمديد الموعد النهائي (العدّاد يستمر).
            </Hint>
            <button
              type="button"
              disabled={actionBusy !== null}
              onClick={() => void doAction('pause', 'تم إيقاف الحملة مؤقتاً')}
              style={lifecycleBtn('var(--gold-ink)', actionBusy === null)}
            >
              {actionBusy === 'pause' ? 'جارٍ الإيقاف…' : 'إيقاف مؤقت للحملة'}
            </button>
          </>
        )}

        {project.status === 'PAUSED' && (
          <>
            <div
              style={{
                padding: '12px 14px', borderRadius: 10, fontSize: 13.5, lineHeight: 1.8,
                border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.08)',
                color: 'var(--text-primary, var(--text-primary))', marginBottom: 10,
              }}
            >
              الحملة موقوفة مؤقتاً — الدعم الجديد متوقف، لكن العدّ التنازلي للموعد النهائي
              <b> مستمر</b> (لا يُمدَّد). الحدّ الأقصى للإيقاف ٧ أيام تراكمياً — المُستخدَم حتى الآن:{' '}
              <b>{Math.floor((project.pausedMsAccrued ?? 0) / 3_600_000)}</b> ساعة.
            </div>
            <button
              type="button"
              disabled={actionBusy !== null}
              onClick={() => void doAction('unpause', 'تم استئناف الحملة')}
              style={lifecycleBtn('var(--pos-ink)', actionBusy === null)}
            >
              {actionBusy === 'unpause' ? 'جارٍ الاستئناف…' : 'استئناف الحملة'}
            </button>
          </>
        )}

        {project.status === 'IN_PRODUCTION' && (
          <>
            <Hint>
              اكتمل تمويل الحملة وهي قيد التنفيذ. عند إتمام صرف جميع المراحل يمكنك وسمها
              كمُسلَّمة لإغلاقها.
            </Hint>
            <button
              type="button"
              disabled={actionBusy !== null}
              onClick={() => void doAction('deliver', 'تم وسم الحملة كمُسلَّمة')}
              style={lifecycleBtn('var(--pos-ink)', actionBusy === null)}
            >
              {actionBusy === 'deliver' ? 'جارٍ…' : 'وسم الحملة كمُسلَّمة'}
            </button>
          </>
        )}

        {actionMsg && (
          <p
            role="alert"
            style={{ fontSize: 13, marginTop: 8, color: actionMsg.kind === 'ok' ? 'var(--pos-ink)' : 'var(--err)' }}
          >
            {actionMsg.text}
          </p>
        )}
      </Card>

      {/* ── CC-22 SEO + CC-20 scheduled launch ──────────────────────────── */}
      <Card title="التحسين والجدولة (SEO)">
        {!editable ? (
          <Hint>تُضبط هذه الحقول قبل النشر فقط.</Hint>
        ) : (
          <>
            <Field label="المُعرّف في الرابط (slug)">
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="my-campaign"
                style={inputStyle(true)}
              />
            </Field>
            <Field label="صورة المشاركة (OG image URL)">
              <input value={ogImage} onChange={(e) => setOgImage(e.target.value)} placeholder="https://…" style={inputStyle(true)} />
            </Field>
            <Field label="وصف الميتا (SEO)">
              <input value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} maxLength={300} style={inputStyle(true)} />
            </Field>
            <Field label="جدولة الإطلاق (يبدأ بعد اعتماد الإدارة)">
              <input type="datetime-local" value={scheduledLaunchAt} onChange={(e) => setScheduledLaunchAt(e.target.value)} style={inputStyle(true)} />
              <Hint>عند اعتماد الإدارة، إن كان الوقت مستقبلياً تدخل الحملة وضع «مجدولة» وتُنشَر تلقائياً في موعدها.</Hint>
            </Field>
            <SectionFooter
              status={seoMsg ?? undefined}
              action={
                <button type="button" disabled={seoBusy} onClick={() => void saveSeo()} style={primaryBtnStyle(!seoBusy)}>
                  {seoBusy ? 'جارٍ الحفظ…' : 'حفظ'}
                </button>
              }
            />
          </>
        )}
      </Card>

      {/* ── Batch DISCOVERY-ENGINE — project tags ───────────────────────── */}
      {/* Not gated on `editable`, for the same reason the video card is not:
          tags change how a project is FOUND, not what was promised to anyone
          who backed it. A creator who realises mid-campaign that their project
          belongs under «تراث سعودي» has to be able to say so. */}
      <Card title="وسوم المشروع">
        <WathbaTagPicker
          initial={project.tags ?? []}
          onSave={async (slugs) => {
            await patchProject({ tagSlugs: slugs });
            // Re-read rather than trust the request: the server drops slugs ops
            // retired between page load and save, and the picker has to show
            // what was actually stored.
            const res = await fetch(`/api/projects/${project.id}`);
            const j = (await res.json().catch(() => ({}))) as {
              tags?: Array<{ slug: string }>;
            };
            router.refresh();
            return (j.tags ?? []).map((t) => t.slug);
          }}
        />
      </Card>

      {/* ── Stage 1 item 12 — campaign video ─────────────────────────────── */}
      {/* NOT gated on `editable`. Everything else in this file freezes at
          launch because it is the funding contract or the pitch a backer read
          before pledging; the card's media is neither, and a live campaign is
          exactly when a creator wants to change it. The API carve-out is an
          allowlist of these two fields — see projects.service update(). */}
      <Card title="فيديو الحملة">
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 12 }}>
          مقطع قصير يظهر على بطاقة مشروعك في الصفحة الرئيسية عند مرور المؤشر فوقها، وبدونه تبقى
          البطاقة بالصورة فقط. الصيغ المقبولة: MP4 أو WebM، بحد أقصى ٢٥ ميجابايت.
        </p>
        {videoUrl ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* The creator sees exactly what the card will play. Without a
                preview there is no way to tell a successful upload from a
                broken one. muted + loop mirrors the card. */}
            <video
              src={videoUrl}
              controls
              muted
              loop
              playsInline
              preload="metadata"
              style={{ width: '100%', maxWidth: 420, aspectRatio: '3 / 2', borderRadius: 12, background: '#000' }}
            />
            {/* The card-media choice. Offered only here, inside the branch
                that already knows a video exists — with no video the question
                has no meaning and an inert control is worse than none. */}
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                ماذا تعرض البطاقة؟
              </legend>
              {(
                [
                  ['VIDEO', 'الفيديو عند مرور المؤشر', 'يبدأ التشغيل صامتاً على الأجهزة المكتبية فقط.'],
                  ['POSTER', 'الصورة فقط', 'تبقى البطاقة ثابتة، ويظل الفيديو على صفحة الحملة.'],
                ] as const
              ).map(([value, label, hint]) => (
                <label
                  key={value}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 9,
                    marginBottom: 8,
                    cursor: vidBusy ? 'default' : 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="cardMedia"
                    value={value}
                    checked={cardMedia === value}
                    disabled={vidBusy}
                    onChange={() => void saveCardMedia(value)}
                    style={{ marginTop: 3, accentColor: 'var(--accent)' }}
                  />
                  <span>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--muted2)', lineHeight: 1.6 }}>
                      {hint}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div>
              <button
                type="button"
                disabled={vidBusy}
                onClick={() => void removeVideo()}
                style={primaryBtnStyle(!vidBusy)}
              >
                {vidBusy ? 'جارٍ…' : 'حذف الفيديو'}
              </button>
            </div>
          </div>
        ) : (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: vidBusy ? 'default' : 'pointer', minHeight: 32 }}>
            <input
              type="file"
              accept="video/mp4,video/webm"
              disabled={vidBusy}
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadVideo(f);
                e.target.value = '';
              }}
            />
            <span style={primaryBtnStyle(!vidBusy)}>{vidBusy ? 'جارٍ الرفع…' : 'رفع فيديو'}</span>
          </label>
        )}
        {vidMsg && (
          <p style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: vidMsg.kind === 'ok' ? 'var(--accent-ink)' : '#c0392b' }}>
            {vidMsg.text}
          </p>
        )}
      </Card>

      {/* ── CC-24 collaborators ──────────────────────────────────────────── */}
      <Card title="فريق المشروع">
        <WathbaDashboardCollaborators projectId={project.id} />
      </Card>

      {/* ── CC-21 duplicate ──────────────────────────────────────────────── */}
      <Card title="أدوات">
        <Hint>أنشئ نسخة (مسودّة جديدة) من هذا المشروع بمكافآته — لإعادة الإطلاق أو كقالب.</Hint>
        <button type="button" disabled={dupBusy} onClick={() => void duplicate()} style={{ ...primaryBtnStyle(!dupBusy), background: dupBusy ? 'rgba(0,0,0,0.12)' : '#4f46e5', color: '#fff' }}>
          {dupBusy ? 'جارٍ الإنشاء…' : 'نسخ المشروع'}
        </button>
      </Card>

      {/* ── Danger zone (Sprint 3 / P1-209) ─────────────────────────────── */}
      <Card title="منطقة الخطر" tone="danger">
        <CancelCampaign project={project} />
      </Card>
    </>
  );
}

/* ─────── Cancel campaign (Sprint 3 / P1-209) ───────────────────────────────── */

const CANCEL_COPY: Record<string, { hint: string; button: string; confirm: string }> = {
  DRAFT: {
    hint: 'حذف المسودّة نهائياً — لا يمكن التراجع.',
    button: 'حذف المسودّة',
    confirm: 'تأكيد الحذف النهائي',
  },
  UNDER_REVIEW: {
    hint: 'سحب المشروع من المراجعة وإعادته مسودّة قابلة للتعديل.',
    button: 'سحب من المراجعة',
    confirm: 'تأكيد السحب',
  },
  LIVE: {
    hint:
      'إلغاء الحملة أثناء التمويل يُلغي جميع الحجوزات ويعيد كامل المبالغ للداعمين تلقائياً (سياسة الاسترداد §5). لا يمكن التراجع.',
    button: 'إلغاء الحملة وإرجاع المبالغ',
    confirm: 'تأكيد الإلغاء وإرجاع كل المبالغ',
  },
};

function CancelCampaign({
  project,
}: {
  project: ApiProjectDetail;
}): React.ReactElement {
  const router = useRouter();
  const projectId = project.id;
  const status = project.status;
  const [arming, setArming] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const copy = CANCEL_COPY[status];
  // CC-05 — typed-confirmation gate for IRREVERSIBLE actions: DRAFT hard-delete
  // and LIVE cancel-with-full-refund. UNDER_REVIEW withdraw is reversible so it
  // keeps the lighter arm→confirm. Server FSM stays the real enforcement point.
  const requiresTyped = status === 'DRAFT' || status === 'LIVE';
  const titleMatches = typed.trim().toLowerCase() === project.titleAr.trim().toLowerCase();
  const canConfirm = !busy && (!requiresTyped || titleMatches);

  if (!copy) {
    return (
      <>
        <Hint>
          لا يمكن إلغاء حملة بحالة «{status}» — الأموال سُوّيت بالفعل. تواصل مع الدعم
          للحالات الاستثنائية.
        </Hint>
        <button type="button" disabled style={dangerBtnDisabledStyle}>
          الإلغاء غير متاح
        </button>
      </>
    );
  }

  async function doCancel(): Promise<void> {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/cancel`, { method: 'POST' });
      const j = (await res.json()) as { outcome?: string; message?: string };
      if (!res.ok) {
        setErr(j.message ?? 'تعذّر الإلغاء');
        return;
      }
      if (j.outcome === 'deleted') router.push('/projects/dashboard');
      else router.refresh();
    } catch {
      setErr('خطأ في الاتصال — أعد المحاولة.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Hint>{copy.hint}</Hint>
      {err && (
        <p role="alert" style={{ fontSize: 13, color: 'var(--err)', margin: '6px 0' }}>
          {err}
        </p>
      )}
      {!arming ? (
        <button
          type="button"
          onClick={() => {
            setArming(true);
            setTyped('');
          }}
          style={{
            padding: '10px 18px',
            background: 'rgba(239,68,68,.08)',
            color: 'var(--err)',
            border: '1px solid rgba(239,68,68,.35)',
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {copy.button}
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* CC-05 — live impact numbers so the creator sees exactly what the
              decision affects before confirming. */}
          {status === 'LIVE' && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid rgba(239,68,68,.30)',
                background: 'rgba(239,68,68,.06)',
                fontSize: 13.5,
                lineHeight: 1.8,
                color: 'var(--text-primary, var(--text-primary))',
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--err)' }}>
                إجراء لا يمكن التراجع عنه
              </div>
              سيقوم النظام تلقائياً بإرجاع كامل المبالغ إلى{' '}
              <b>{project.backersCount.toLocaleString('ar-SA')}</b> داعم — بإجمالي{' '}
              <b>{fmtSAR(project.raisedHalalas)}</b>، وتنتقل الحملة نهائياً إلى حالة «متعثّر».
              <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--text-secondary, #3b4942)' }}>
                أنت لا تحرّك الأموال بنفسك — الاسترداد نتيجة نظامية تلقائية للإلغاء.
              </div>
            </div>
          )}
          {status === 'DRAFT' && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid rgba(239,68,68,.30)',
                background: 'rgba(239,68,68,.06)',
                fontSize: 13.5,
                color: 'var(--text-primary, var(--text-primary))',
              }}
            >
              سيتم حذف هذه المسودّة وكل بياناتها نهائياً — لا يمكن استرجاعها.
            </div>
          )}
          {requiresTyped && (
            <label style={{ fontSize: 13, color: 'var(--text-secondary, #3b4942)', display: 'block' }}>
              للتأكيد، اكتب اسم الحملة: <b style={{ color: 'var(--text-primary, var(--text-primary))' }}>{project.titleAr}</b>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={project.titleAr}
                aria-label="اكتب اسم الحملة للتأكيد"
                autoComplete="off"
                style={{
                  width: '100%',
                  marginTop: 6,
                  padding: '9px 11px',
                  borderRadius: 10,
                  border: `1px solid ${titleMatches ? 'rgba(5,166,97,.5)' : 'rgba(239,68,68,.35)'}`,
                  background: 'var(--bg-base, #fff)',
                  color: 'var(--text-primary, var(--text-primary))',
                  fontFamily: 'inherit',
                  fontSize: 14,
                }}
              />
            </label>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={!canConfirm}
              onClick={() => void doCancel()}
              style={{
                padding: '10px 18px',
                background: '#b91c1c',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 14,
                cursor: canConfirm ? (busy ? 'wait' : 'pointer') : 'not-allowed',
                fontFamily: 'inherit',
                opacity: canConfirm ? 1 : 0.5,
              }}
            >
              {busy ? 'جارٍ التنفيذ…' : copy.confirm}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setArming(false);
                setTyped('');
              }}
              style={{
                padding: '10px 18px',
                background: 'transparent',
                color: 'var(--muted, #667)',
                border: '1px solid rgba(0,0,0,.15)',
                borderRadius: 10,
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              تراجع
            </button>
          </div>
        </div>
      )}
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
          color: isDanger ? 'var(--err)' : 'var(--text-primary, var(--text-primary))',
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
        color: 'var(--text-tertiary, var(--muted2))',
        marginTop: 6,
      }}
    >
      {children}
    </div>
  );
}

function ErrorLine({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div style={{ fontSize: 12, color: 'var(--err)', marginTop: 6, fontWeight: 600 }}>
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
        color: isErr ? 'var(--err)' : '#92400e',
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
      <span style={{ fontWeight: 600, color: 'var(--text-primary, var(--text-primary))' }}>
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
        {status?.kind === 'ok' && <span style={{ color: 'var(--pos-ink)' }}>✓ {status.text}</span>}
        {status?.kind === 'err' && <span style={{ color: 'var(--err)' }}>{status.text}</span>}
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
  color: 'var(--text-primary, var(--text-primary))',
  fontFamily: 'inherit',
  opacity: enabled ? 1 : 0.7,
});

const primaryBtnStyle = (enabled: boolean): React.CSSProperties => ({
  padding: '10px 18px',
  background: enabled ? 'var(--brand-primary, #05a661)' : 'rgba(0,0,0,0.12)',
  color: 'var(--on-brand, #08130d)',
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

/** Lifecycle-action button (CC-14 pause/unpause, CC-09 deliver). */
const lifecycleBtn = (color: string, enabled: boolean): React.CSSProperties => ({
  padding: '10px 18px',
  background: enabled ? color : 'rgba(0,0,0,0.12)',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  fontWeight: 700,
  fontSize: 14,
  cursor: enabled ? 'pointer' : 'not-allowed',
  fontFamily: 'inherit',
  opacity: enabled ? 1 : 0.7,
});
