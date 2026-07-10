import Link from 'next/link';

import type { ApiCategoryNode, ApiDiscoverProject, ApiDiscoverResult } from '@/lib/api/wathba';
import { Icon, Num } from './wathba-icons';

/**
 * Batch CAT / Part 3 — server-rendered category discover page (Arabic RTL).
 * Filter chips + subcategory chips are URL-param links (shareable, crawlable,
 * ISR-cached). Covers all four states: error, empty (suggests siblings),
 * populated. The loading state is the route-level loading.tsx skeleton.
 */

const FILTERS: Array<{ key: string; ar: string }> = [
  { key: 'trending', ar: 'الرائجة' },
  { key: 'nearly_funded', ar: 'قاربت على التمويل' },
  { key: 'just_launched', ar: 'أُطلقت حديثاً' },
  { key: 'near_you', ar: 'قريبة منك' },
  { key: 'staff_pick', ar: 'مختارات وثبة' },
];

function ar(n: number): string {
  return String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!);
}

function pct(p: ApiDiscoverProject): number {
  return p.fundingGoalHalalas > 0
    ? Math.round((p.raisedHalalas / p.fundingGoalHalalas) * 100)
    : 0;
}

function daysLeft(p: ApiDiscoverProject): number {
  return Math.max(0, Math.ceil((new Date(p.deadline).getTime() - Date.now()) / 86_400_000));
}

function base(catSlug: string, subSlug?: string): string {
  return subSlug
    ? `/projects/discover/${catSlug}/${subSlug}`
    : `/projects/discover/${catSlug}`;
}

function chipHref(catSlug: string, subSlug: string | undefined, filter?: string): string {
  return filter ? `${base(catSlug, subSlug)}?filter=${filter}` : base(catSlug, subSlug);
}

function ProjectCard({ p }: { p: ApiDiscoverProject }) {
  const percent = pct(p);
  return (
    <Link
      href={`/projects/${p.id}`}
      data-testid="discover-card"
      style={{
        background: 'var(--card)',
        border: '1px solid rgba(var(--ink-rgb),.09)',
        borderRadius: 18,
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'inherit',
        display: 'block',
        boxShadow: 'var(--card-shadow)',
      }}
    >
      <div className="wathba-ph" style={{ height: 150, position: 'relative' }}>
        {p.isStaffPick && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              insetInlineStart: 10,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: 'var(--accent)',
              color: 'var(--on-accent)',
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 9px',
              borderRadius: 9,
            }}
          >
            <Icon name="verified" size={13} color="var(--on-accent)" />
            مختارات وثبة
          </div>
        )}
        <div style={{ position: 'absolute', insetInline: 0, bottom: 0, height: 5, background: 'rgba(var(--ink-rgb),.12)' }}>
          <div style={{ height: '100%', width: `${Math.min(100, percent)}%`, background: 'var(--grad)' }} />
        </div>
      </div>
      <div style={{ padding: '15px 16px 17px' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4, marginBottom: 6 }}>
          {p.titleAr}
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--muted2)',
            marginBottom: 12,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {p.shortDescAr}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
          <Num style={{ fontWeight: 700, color: 'var(--accent-ink)' }}>%{ar(percent)}</Num>
          <span style={{ color: 'var(--muted2)' }}>مموَّل</span>
          <span style={{ color: 'var(--muted2)', marginInlineStart: 'auto' }}>
            {ar(p.backersCount)} داعم · {ar(daysLeft(p))} يوم متبقٍ
          </span>
        </div>
      </div>
    </Link>
  );
}

export function WathbaDiscoverCategory({
  cat,
  sub,
  result,
  activeFilter,
}: {
  cat: ApiCategoryNode;
  sub?: ApiCategoryNode | null;
  result: ApiDiscoverResult | null;
  activeFilter?: string;
}) {
  const items = result?.items ?? [];
  const siblings = cat.children.filter((c) => c.slug !== sub?.slug).slice(0, 6);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 26px 60px' }}>
      {/* Breadcrumb */}
      <nav aria-label="مسار التنقل" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted2)', marginBottom: 14 }}>
        <Link href="/projects/discover-all" style={{ color: 'inherit', textDecoration: 'none' }}>الفئات</Link>
        <Icon name="chevron_left" size={15} color="var(--muted2)" />
        <Link href={base(cat.slug)} style={{ color: sub ? 'inherit' : 'var(--text)', textDecoration: 'none', fontWeight: sub ? 400 : 700 }}>
          {cat.nameAr}
        </Link>
        {sub && (
          <>
            <Icon name="chevron_left" size={15} color="var(--muted2)" />
            <span style={{ color: 'var(--text)', fontWeight: 700 }}>{sub.nameAr}</span>
          </>
        )}
      </nav>

      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>{sub?.nameAr ?? cat.nameAr}</h1>
      <div style={{ fontSize: 14, color: 'var(--muted2)', marginBottom: 22 }}>
        {ar(cat.liveCount)} مشروع نشط في {cat.nameAr}
      </div>

      {/* Subcategory chips */}
      {cat.children.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {cat.children.map((s) => {
            const active = s.slug === sub?.slug;
            return (
              <Link
                key={s.id}
                href={base(cat.slug, s.slug)}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  padding: '7px 13px',
                  borderRadius: 999,
                  textDecoration: 'none',
                  background: active ? 'var(--accent)' : 'rgba(var(--ink-rgb),.05)',
                  color: active ? 'var(--on-accent)' : 'var(--text-soft)',
                  border: '1px solid rgba(var(--ink-rgb),.08)',
                }}
              >
                {s.nameAr}
              </Link>
            );
          })}
        </div>
      )}

      {/* Filter chips (URL params) */}
      <div role="group" aria-label="تصفية حسب" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 26 }}>
        <Link
          href={chipHref(cat.slug, sub?.slug)}
          data-filter="all"
          style={filterChipStyle(!activeFilter)}
        >
          الكل
        </Link>
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={chipHref(cat.slug, sub?.slug, f.key)}
            data-filter={f.key}
            style={filterChipStyle(activeFilter === f.key)}
          >
            {f.ar}
          </Link>
        ))}
      </div>

      {/* States: error · empty · populated */}
      {result === null ? (
        <div style={emptyBoxStyle}>
          <Icon name="info" size={26} color="var(--muted2)" />
          <div style={{ marginTop: 10 }}>تعذّر تحميل المشاريع. حاول مجدداً.</div>
        </div>
      ) : items.length === 0 ? (
        <div style={emptyBoxStyle}>
          <Icon name="explore" size={26} color="var(--muted2)" />
          <div style={{ marginTop: 10, fontWeight: 600 }}>لا توجد مشاريع مطابقة حالياً.</div>
          {siblings.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 13, color: 'var(--muted2)', marginBottom: 8 }}>جرّب فئات فرعية أخرى:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {siblings.map((s) => (
                  <Link key={s.id} href={base(cat.slug, s.slug)} style={filterChipStyle(false)}>
                    {s.nameAr}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          data-testid="discover-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 20,
          }}
        >
          {items.map((p) => (
            <ProjectCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}

const emptyBoxStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '60px 24px',
  background: 'var(--card)',
  border: '1px dashed rgba(var(--ink-rgb),.14)',
  borderRadius: 20,
  color: 'var(--muted)',
};

function filterChipStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: 13,
    fontWeight: 600,
    padding: '8px 15px',
    borderRadius: 999,
    textDecoration: 'none',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? 'var(--on-accent)' : 'var(--text-soft)',
    border: `1px solid ${active ? 'var(--accent)' : 'rgba(var(--ink-rgb),.14)'}`,
  };
}
