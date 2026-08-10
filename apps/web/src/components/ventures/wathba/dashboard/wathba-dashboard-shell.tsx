'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { WathbaFeedbackProvider } from '../wathba-feedback';
import { WathbaThemeRoot } from '../wathba-theme-root';
import { Icon } from '../wathba-icons';

/**
 * Per-project creator dashboard — RTL side-nav shell. Each link maps to a
 * managed section listed in the engagement+dashboard spec (§I). The nav is
 * always visible (no hide-on-mobile collapse — KSA SMB Arabic SMB pattern,
 * per the Hraj F1 standing rule).
 */

interface NavItem {
  href: string;
  labelAr: string;
  icon: string;
}

function navFor(projectId: string): NavItem[] {
  const base = `/projects/dashboard/${projectId}`;
  return [
    { href: base, labelAr: 'نظرة عامة', icon: 'dashboard' },
    { href: `${base}/rewards`, labelAr: 'المكافآت والإضافات', icon: 'redeem' },
    { href: `${base}/story`, labelAr: 'القصة', icon: 'auto_stories' },
    { href: `${base}/milestones`, labelAr: 'المراحل والشفافية', icon: 'flag' },
    { href: `${base}/updates`, labelAr: 'التحديثات', icon: 'campaign' },
    { href: `${base}/contests`, labelAr: 'علّق واربح', icon: 'celebration' },
    { href: `${base}/rfqs`, labelAr: 'طلبات التوريد', icon: 'gavel' },
    { href: `${base}/payouts`, labelAr: 'الدفعات والضمان', icon: 'account_balance' },
    { href: `${base}/backers`, labelAr: 'الداعمون', icon: 'group' },
    { href: `${base}/comments`, labelAr: 'التعليقات', icon: 'forum' },
    { href: `${base}/faq`, labelAr: 'الأسئلة', icon: 'help' },
    { href: `${base}/community`, labelAr: 'المجتمع', icon: 'groups' },
    { href: `${base}/creator`, labelAr: 'ملفي كمبدع', icon: 'person' },
    { href: `${base}/analytics`, labelAr: 'التحليلات', icon: 'query_stats' },
    { href: `${base}/activity`, labelAr: 'سجل النشاط', icon: 'history' },
    { href: `${base}/settings`, labelAr: 'الإعدادات', icon: 'settings' },
  ];
}

const STATUS_AR: Record<string, string> = {
  DRAFT: 'مسودة',
  UNDER_REVIEW: 'قيد المراجعة',
  LIVE: 'منشور',
  PAUSED: 'موقوفة مؤقتاً',
  SUCCESSFUL: 'ناجح',
  FUNDED: 'تم تمويله',
  IN_PRODUCTION: 'قيد الإنتاج',
  DELIVERED: 'مُسلَّم',
  FAILED: 'فشل',
  REFUNDED: 'مُسترَد',
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: '#9ca3af',
  UNDER_REVIEW: '#f59e0b',
  LIVE: '#10b981',
  PAUSED: '#f59e0b',
  SUCCESSFUL: '#10b981',
  FUNDED: '#10b981',
  IN_PRODUCTION: '#6366f1',
  DELIVERED: '#10b981',
  FAILED: '#ef4444',
  REFUNDED: '#ef4444',
};

export function DashboardShell({
  projectId,
  projectTitle,
  projectStatus,
  children,
}: {
  projectId: string;
  projectTitle: string;
  projectStatus: string;
  children: React.ReactNode;
}): React.ReactElement {
  const pathname = usePathname();
  const items = navFor(projectId);

  const isActive = (href: string): boolean => {
    if (href === `/projects/dashboard/${projectId}`) return pathname === href;
    return pathname?.startsWith(href) ?? false;
  };

  return (
    // Batch PAGE-PARITY — this surface now carries the platform palette.
    //
    // It used to be a bare <div> with its own hardcoded ground, reading
    // --bg-base / --bg-elevated / --border-subtle / --text-tertiary /
    // --brand-* — a parallel vocabulary that existed in no token file, so all
    // 224 usages silently painted their inline hex fallbacks. Nothing looked
    // broken; the surface just never followed the theme. A creator who chose
    // dark got 18 white pages with an indigo accent instead of the green
    // identity. Those names are now aliased onto the real layers in
    // wathba-tokens.ts, and WathbaThemeRoot supplies them.
    //
    // The theme ROOT, not the full WathbaShell: this surface has its own
    // sidebar and no site footer, and adding the public header would be a
    // redesign rather than the propagation this batch is for.
    <WathbaThemeRoot
      className="wathba-dash-shell"
      style={{
        display: 'grid',
        // 260px + 1fr, and on a phone that 1fr computed to ONE HUNDRED PIXELS.
        // The sidebar kept its full width at every viewport, so all 17
        // per-project routes squeezed the dashboard into a 100px column and
        // then blew out to 659-934px of horizontal scroll at 360. The heading
        // was clipped, body text wrapped to roughly one word per line.
        //
        // The nav stays ALWAYS VISIBLE per the standing rule above — what the
        // media query in globals.css changes is its AXIS, not its presence.
        // Nothing moves behind a hamburger.
        gridTemplateColumns: '260px 1fr',
        minHeight: '100dvh',
        background: 'var(--surface-0)',
      }}
    >
      {/* Six dashboard screens call useConfirm() and the rewards manager calls
       *  useToast(), but nothing here ever mounted the provider — so every
       *  confirm degraded to the browser's own window.confirm (LTR, off-design)
       *  and every toast to a silent no-op, i.e. the rewards manager reported
       *  success and failure identically: not at all.
       *  Inside the div, not around it, so the overlays inherit the RTL
       *  direction and the Arabic font. The tokens they read resolve through
       *  the fallback chain in wathba-feedback.tsx — this surface has no
       *  data-theme and none of the ventures variables. */}
      <WathbaFeedbackProvider>
        <aside
          className="wathba-dash-aside"
          style={{
            background: 'var(--bg-elevated, #fff)',
            borderInlineStart: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
            padding: '24px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <Link
            href={
              projectStatus === 'DRAFT' || projectStatus === 'UNDER_REVIEW'
                ? `/projects/dashboard/${projectId}/preview`
                : `/projects/${projectId}`
            }
            style={{
              display: 'block',
              padding: '8px 12px 16px',
              color: 'var(--text-primary, var(--text-primary))',
              textDecoration: 'none',
              borderBottom: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-tertiary, var(--muted2))', marginBottom: 4 }}>
              مشروعك
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, lineHeight: 1.35 }}>
              {projectTitle}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: STATUS_COLOR[projectStatus] ?? '#9ca3af',
                }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-secondary, #3b4942)' }}>
                {STATUS_AR[projectStatus] ?? projectStatus}
              </span>
              <span style={{ marginInlineStart: 'auto', fontSize: 11, color: 'var(--brand-ink, var(--pos-ink))' }}>
                {projectStatus === 'DRAFT' || projectStatus === 'UNDER_REVIEW' ? 'معاينة كزائر ←' : 'عرض الحملة ←'}
              </span>
            </div>
          </Link>

          <nav className="wathba-dash-nav" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {items.map((it) => {
              const active = isActive(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: 10,
                    textDecoration: 'none',
                    fontSize: 14,
                    fontWeight: active ? 600 : 500,
                    background: active ? 'rgba(5,166,97,0.08)' : 'transparent',
                    color: active ? 'var(--brand-ink, var(--pos-ink))' : 'var(--text-primary, var(--text-primary))',
                  }}
                >
                  <Icon name={it.icon} size={18} />
                  <span>{it.labelAr}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="wathba-dash-main" style={{ padding: '32px 40px', minWidth: 0 }}>{children}</main>
      </WathbaFeedbackProvider>
    </WathbaThemeRoot>
  );
}
