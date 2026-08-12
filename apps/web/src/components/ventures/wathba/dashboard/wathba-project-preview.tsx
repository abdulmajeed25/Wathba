import Link from 'next/link';

import type { ApiProjectDetail, ApiRewardTier } from '@/lib/api/wathba';
import { formatSarFromHalalas } from '@/lib/i18n/format';

/**
 * Draft preview-as-visitor (Creator-CC / CC-19). Renders the project's REAL
 * content (title, story, reward tiers, funding target) the way a visitor sees
 * the substance — used for DRAFT/UNDER_REVIEW projects that aren't yet on the
 * public campaign page. Owner-gated by the dashboard layout.
 */
const fmtSAR = (h: number): string => formatSarFromHalalas('ar', h);

const CATEGORY_AR: Record<string, string> = {
  TECH: 'تقنية', DESIGN: 'تصميم', FILM: 'أفلام', FOOD: 'طعام',
  GAMES: 'ألعاب', PUBLISHING: 'نشر', FASHION: 'أزياء', ART: 'فن', SOCIAL: 'اجتماعي',
};

export function WathbaProjectPreview({
  projectId,
  project,
}: {
  projectId: string;
  project: ApiProjectDetail;
}): React.ReactElement {
  const tiers = ((project.rewardTiers ?? []) as unknown as ApiRewardTier[])
    .slice()
    .sort((a, b) => (a.amountHalalas ?? 0) - (b.amountHalalas ?? 0));
  const deadline = project.deadline ? new Date(project.deadline) : null;

  return (
    <div dir="rtl">
      {/* preview banner */}
      <div
        style={{
          position: 'sticky', top: 0, zIndex: 10, marginBottom: 20,
          padding: '10px 16px', borderRadius: 12,
          background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.35)',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 18 }}>👁</span>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--purple-ink)' }}>
          معاينة — هكذا يرى الزوّار حملتك قبل النشر
        </span>
        <Link
          href={`/projects/dashboard/${projectId}`}
          style={{ marginInlineStart: 'auto', fontSize: 13, fontWeight: 600, color: 'var(--purple-ink)', textDecoration: 'none' }}
        >
          العودة للوحة التحكم ←
        </Link>
      </div>

      {/* header */}
      <div style={{ marginBottom: 20 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-ink, var(--pos-ink))' }}>
          {CATEGORY_AR[project.category] ?? project.category}
        </span>
        <h1 style={{ fontSize: 30, fontWeight: 800, margin: '6px 0 8px', lineHeight: 1.3 }}>{project.titleAr}</h1>
        <p style={{ fontSize: 16, color: 'var(--text-secondary, #3b4942)', margin: 0, lineHeight: 1.7 }}>
          {project.shortDescAr}
        </p>
      </div>

      {/* media */}
      {(project.mediaUrls ?? []).length > 0 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={project.mediaUrls[0]}
          alt={project.titleAr}
          style={{ width: '100%', maxHeight: 380, objectFit: 'cover', borderRadius: 16, marginBottom: 20 }}
        />
      )}

      <div className="wathba-dash-stack" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 24, alignItems: 'start' }}>
        {/* story */}
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>عن المشروع</h2>
          <StoryRender story={project.storyAr ?? ''} />
        </div>

        {/* funding rail + tiers */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 64 }}>
          <div style={{ background: 'var(--bg-elevated, #fff)', border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))', borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary, var(--muted2))' }}>هدف التمويل</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--brand-ink, var(--pos-ink))' }}>
              {fmtSAR(project.fundingGoalHalalas)}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary, #3b4942)', marginTop: 8, lineHeight: 1.9 }}>
              <div>عتبة الإفراج: {project.releaseThresholdPct}%</div>
              <div>المدّة: {project.durationDays} يوماً</div>
              {deadline && <div>الموعد النهائي: {deadline.toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { year: 'numeric', month: 'short', day: 'numeric' })}</div>}
            </div>
            <button
              type="button"
              disabled
              style={{
                width: '100%', marginTop: 14, padding: '11px', borderRadius: 11, border: 'none',
                background: 'var(--grad, linear-gradient(135deg,#05a661,#0bd47f))', color: 'var(--on-accent, #08130d)',
                fontWeight: 700, fontSize: 14, fontFamily: 'inherit', opacity: 0.7, cursor: 'not-allowed',
              }}
            >
              ادعم المشروع (معاينة)
            </button>
          </div>

          {tiers.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>المكافآت</h3>
              {tiers.map((t) => (
                <div key={t.id} style={{ background: 'var(--bg-elevated, #fff)', border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))', borderRadius: 12, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <strong style={{ fontSize: 14 }}>{t.titleAr}</strong>
                    <span style={{ fontWeight: 700, color: 'var(--brand-ink, var(--pos-ink))', whiteSpace: 'nowrap' }}>
                      {fmtSAR(t.amountHalalas)}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary, #3b4942)', margin: '6px 0 0', lineHeight: 1.6 }}>{t.descAr}</p>
                  {t.estDeliveryDate && (
                    <div style={{ fontSize: 11.5, color: 'var(--text-tertiary, var(--muted2))', marginTop: 6 }}>
                      التسليم المتوقّع: {new Date(t.estDeliveryDate).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { year: 'numeric', month: 'short' })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/** Minimal markdown-lite render matching the story editor's authoring subset. */
function StoryRender({ story }: { story: string }): React.ReactElement {
  const lines = story.split('\n');
  const out: React.ReactNode[] = [];
  let para: string[] = [];
  const flush = (key: string): void => {
    if (para.length) {
      out.push(
        <p key={key} style={{ fontSize: 15, lineHeight: 1.9, color: 'var(--text-primary, var(--text-primary))', margin: '0 0 14px' }}>
          {para.join(' ')}
        </p>,
      );
      para = [];
    }
  };
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (line === '') { flush(`p${i}`); return; }
    const img = /^!\[[^\]]*\]\(([^)]+)\)$/.exec(line);
    if (line.startsWith('## ')) {
      flush(`p${i}`);
      out.push(<h3 key={i} style={{ fontSize: 17, fontWeight: 700, margin: '18px 0 8px' }}>{line.slice(3)}</h3>);
    } else if (line.startsWith('# ')) {
      flush(`p${i}`);
      out.push(<h2 key={i} style={{ fontSize: 20, fontWeight: 800, margin: '20px 0 10px' }}>{line.slice(2)}</h2>);
    } else if (img) {
      flush(`p${i}`);
      // eslint-disable-next-line @next/next/no-img-element
      out.push(<img key={i} src={img[1]} alt="" style={{ width: '100%', borderRadius: 12, margin: '10px 0' }} />);
    } else {
      para.push(line);
    }
  });
  flush('end');
  return <div>{out}</div>;
}
