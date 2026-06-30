'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
    { href: `${base}/comments`, labelAr: 'التعليقات', icon: 'forum' },
    { href: `${base}/faq`, labelAr: 'الأسئلة', icon: 'help' },
    { href: `${base}/community`, labelAr: 'المجتمع', icon: 'groups' },
    { href: `${base}/settings`, labelAr: 'الإعدادات', icon: 'settings' },
  ];
}

const STATUS_AR: Record<string, string> = {
  DRAFT: 'مسودة',
  UNDER_REVIEW: 'قيد المراجعة',
  LIVE: 'منشور',
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
    <div
      dir="rtl"
      style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr',
        minHeight: '100dvh',
        background: 'var(--bg-base, #f4f6f1)',
        fontFamily: 'var(--font-arabic), system-ui, sans-serif',
      }}
    >
      <aside
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
          href={`/projects/${projectId}`}
          style={{
            display: 'block',
            padding: '8px 12px 16px',
            color: 'var(--text-primary, #16201b)',
            textDecoration: 'none',
            borderBottom: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--text-tertiary, #5d6b62)', marginBottom: 4 }}>
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
            <span style={{ marginInlineStart: 'auto', fontSize: 11, color: 'var(--brand-primary, #05a661)' }}>
              عرض الحملة ←
            </span>
          </div>
        </Link>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                  color: active ? 'var(--brand-primary, #05a661)' : 'var(--text-primary, #16201b)',
                }}
              >
                <Icon name={it.icon} size={18} />
                <span>{it.labelAr}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <main style={{ padding: '32px 40px', minWidth: 0 }}>{children}</main>
    </div>
  );
}
