'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import type { ApiCategoryFacetNode, ApiDiscoverAllResult, ApiDiscoverCard, ApiDiscoverFacets } from '@/lib/api/wathba';
import { track } from '@/lib/analytics';
import { Icon } from './wathba-icons';
import { WathbaDiscoverAllCard } from './wathba-discover-all-card';
import { DURATION_OPTS } from './discover-all-constants';
import {
  MONEY_BRACKETS, PCT_OPTS, QUICK_REGIONS, REGIONS, SORTS, arabicCount, toArabicDigits,
} from './discover-all-constants';
import { SEARCH_CHIPS } from './wathba-search-chips';

/**
 * Batch DISC — the advanced discover page (/projects/discover-all). RTL: filter
 * sidebar on the RIGHT, results grid (3/2/1) on the LEFT. Every filter/sort is
 * URL-encoded; changing a filter soft-navigates (server re-renders the first
 * page + fresh facet counts, no full reload). "Load more" appends client-side.
 */

type SP = Record<string, string | undefined>;

export function WathbaDiscoverAll({
  initial,
  facets,
  sp,
  signedIn,
  q,
}: {
  initial: ApiDiscoverAllResult;
  facets: ApiDiscoverFacets | null;
  sp: SP;
  signedIn: boolean;
  /** Batch SEARCH Part 3 — set on /projects/search: ?q= is one more
   *  combinable predicate over the SAME component + query layer. */
  q?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const spKey = JSON.stringify(sp);
  const [items, setItems] = useState<ApiDiscoverCard[]>(initial.items);
  const [page, setPage] = useState(initial.page);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [loading, setLoading] = useState(false);

  // A new filter set (soft nav) delivers fresh `initial` — reset the list.
  useEffect(() => {
    setItems(initial.items);
    setPage(initial.page);
    setHasMore(initial.hasMore);
  }, [spKey, initial]);

  const csv = (key: string): string[] => (sp[key] ?? '').split(',').filter(Boolean);
  const has = (key: string, val: string): boolean => csv(key).includes(val);

  const navigate = (next: SP): void => {
    const qs = new URLSearchParams();
    const merged: SP = { ...sp, ...next, page: undefined };
    for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, v);
    const s = qs.toString();

    /*
     * Batch DISCOVERY-ENGINE Unit 5 — the ONLY place a filter is recorded.
     *
     * Every sidebar control funnels through navigate(), so instrumenting here
     * covers all of them and cannot drift as sections are added. It records the
     * dimension and value that CHANGED, not the whole filter set: counting the
     * merged state would score every already-applied filter again on each
     * click, and the homepage row would end up ranking whatever people leave on
     * rather than what they reach for.
     *
     * PDPL: aggregate only. The API stores this as {key, value} against a random
     * anonId and nothing else, groups by (key, value), and builds no per-user
     * profile — see popular-facets.service.ts. `q` is deliberately never sent;
     * the words a reader types are not counted anywhere.
     */
    for (const [k, v] of Object.entries(next)) {
      if (!v || k === 'page') continue;
      // A CSV toggle sends the last segment — the one the reader just added.
      const value = v.split(',').filter(Boolean).pop();
      if (value) track(q ? 'search_performed' : 'filter_applied', { key: k, value });
    }

    router.push(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };

  const toggleCsv = (key: string, val: string): void => {
    const cur = csv(key);
    const next = cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val];
    navigate({ [key]: next.join(',') || undefined });
  };

  const loadMore = async (): Promise<void> => {
    if (loading || !hasMore) return;
    setLoading(true);
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v && k !== 'page') qs.set(k, v);
    qs.set('page', String(page + 1));
    try {
      const res = await fetch(`/api/discover-all?${qs.toString()}`);
      if (res.ok) {
        const d = (await res.json()) as ApiDiscoverAllResult;
        setItems((prev) => [...prev, ...d.items]);
        setPage(d.page);
        setHasMore(d.hasMore);
      }
    } finally {
      setLoading(false);
    }
  };

  const total = initial.total;
  const sorts = useMemo(() => SORTS.filter((s) => s.key !== 'near_me' || sp.region), [sp.region]);
  const curSort = sp.sort ?? 'relevance';

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', padding: '24px 18px 70px' }}>
      <div
        className="wathba-discover-row"
        style={{
          display: 'flex',
          // STAKES/S-2/M5 — stacks below 760px via CSS (globals.css) so the row
          // no longer forces a horizontal scroll at 360px.
          flexDirection: 'row-reverse',
          gap: 28,
          alignItems: 'flex-start',
        }}
      >
        {/* SIDEBAR (right in RTL; full-width on top when stacked) */}
        <aside
          className="wathba-discover-aside"
          style={{ width: 288, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }}
          aria-label="عوامل التصفية"
        >
          <StatusSection facets={facets} has={has} sp={sp} toggleCsv={toggleCsv} navigate={navigate} />
          <CategorySection facets={facets} has={has} toggleCsv={toggleCsv} />
          {/* Tags sit next to the category tree because they answer the same
              question from the other direction — «تراث سعودي» cuts across the
              categories rather than living under one. */}
          <TagSection facets={facets} has={has} toggleCsv={toggleCsv} />
          <LocationSection facets={facets} sp={sp} navigate={navigate} />
          <MediaAndLengthSection facets={facets} sp={sp} navigate={navigate} />
          <MoneySection title="الهدف" paramMin="goalMin" paramMax="goalMax" counts={facets?.goals} sp={sp} navigate={navigate} />
          <MoneySection title="المبلغ المُجمَّع" paramMin="raisedMin" paramMax="raisedMax" counts={facets?.raised} sp={sp} navigate={navigate} />
          <PctSection facets={facets} sp={sp} navigate={navigate} />
          <ShowOnlySection facets={facets} has={has} toggleCsv={toggleCsv} signedIn={signedIn} />
          <CampaignsSection facets={facets} sp={sp} navigate={navigate} />
        </aside>

        {/* RESULTS (left) */}
        <section style={{ flex: 1, minWidth: 0 }}>
          {/* Top bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 22, fontWeight: 800 }} data-testid="discover-total">
              {q ? <>{arabicCount(total)} نتيجة عن «{q}»</> : <>{arabicCount(total)} مشروعاً</>}
            </h1>
            <label style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
              ترتيب حسب
              <select
                value={curSort}
                onChange={(e) => navigate({ sort: e.target.value === 'relevance' ? undefined : e.target.value })}
                data-testid="discover-sort"
                style={{
                  fontFamily: 'inherit',
                  fontSize: 13.5,
                  fontWeight: 600,
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(var(--ink-rgb),.14)',
                  background: 'var(--card)',
                  color: 'var(--text)',
                }}
              >
                {sorts.map((s) => (
                  <option key={s.key} value={s.key}>{s.ar}</option>
                ))}
              </select>
            </label>
          </div>

          {items.length === 0 ? (
            <div style={emptyBox} data-testid="zero-results">
              <Icon name="explore" size={26} color="var(--muted2)" />
              <div style={{ marginTop: 10, fontWeight: 600 }}>
                {q ? `لا نتائج عن «${q}»` : 'لا توجد مشاريع مطابقة لعوامل التصفية.'}
              </div>
              {q ? <DidYouMean q={q} /> : null}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                {SEARCH_CHIPS.map((chip) => (
                  <a
                    key={chip}
                    href={`/projects/search?q=${encodeURIComponent(chip)}`}
                    style={{
                      fontSize: 12.5, fontWeight: 600, color: 'var(--text)', textDecoration: 'none',
                      border: '1px solid rgba(var(--ink-rgb),.14)', padding: '6px 13px', borderRadius: 999,
                    }}
                  >
                    {chip}
                  </a>
                ))}
              </div>
              <button
                type="button"
                onClick={() => router.push(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname, { scroll: false })}
                style={resetBtn}
              >
                مسح كل عوامل التصفية
              </button>
            </div>
          ) : (
            <>
              <div
                data-testid="discover-grid"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}
              >
                {items.map((p) => (
                  <WathbaDiscoverAllCard key={p.id} p={p} />
                ))}
              </div>

              {/* Load-more + progress */}
              <div style={{ marginTop: 28, textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--muted2)', marginBottom: 8 }}>
                  شاهدت {toArabicDigits(items.length)} من {arabicCount(total)} مشروعاً
                </div>
                <div style={{ height: 4, background: 'rgba(var(--ink-rgb),.1)', borderRadius: 999, overflow: 'hidden', maxWidth: 320, margin: '0 auto 16px' }}>
                  <div style={{ height: '100%', width: `${total ? Math.min(100, (items.length / total) * 100) : 100}%`, background: 'var(--grad)' }} />
                </div>
                {hasMore && (
                  <button type="button" onClick={() => void loadMore()} disabled={loading} style={loadMoreBtn(loading)} data-testid="load-more">
                    {loading ? 'جارٍ التحميل…' : 'عرض المزيد من المشاريع'}
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/* ---------- sidebar sections ---------------------------------------------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '14px 4px', borderBottom: '1px solid rgba(var(--ink-rgb),.07)' }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function Row({
  label, count, active, onClick, kind = 'checkbox', testId,
}: {
  label: string; count?: number; active: boolean; onClick: () => void; kind?: 'checkbox' | 'radio'; testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role={kind === 'radio' ? 'radio' : 'checkbox'}
      aria-checked={active}
      data-testid={testId}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'start',
        padding: '6px 6px', borderRadius: 8, border: 'none', background: 'transparent',
        cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, color: 'var(--text-soft)',
      }}
    >
      <span
        style={{
          width: 17, height: 17, flexShrink: 0, borderRadius: kind === 'radio' ? 999 : 5,
          border: `1.5px solid ${active ? 'var(--accent)' : 'rgba(var(--ink-rgb),.28)'}`,
          background: active ? 'var(--accent)' : 'transparent',
          display: 'grid', placeItems: 'center',
        }}
      >
        {active && <Icon name="check" size={12} color="var(--on-accent)" />}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
      {count !== undefined && <span style={{ fontSize: 12, color: 'var(--muted2)' }}>{toArabicDigits(count)}</span>}
    </button>
  );
}

function StatusSection({ facets, has, sp, toggleCsv, navigate }: {
  facets: ApiDiscoverFacets | null; has: (k: string, v: string) => boolean; sp: SP;
  toggleCsv: (k: string, v: string) => void; navigate: (n: SP) => void;
}) {
  const ended = sp.includeEnded === '1';
  return (
    <Section title="حالة المشروع">
      {/* قادمة (upcoming) omitted — scheduled-launch discovery deferred. */}
      <Row label="نشطة" count={facets?.statuses.live} active={has('status', 'live')} onClick={() => toggleCsv('status', 'live')} />
      <Row label="مموَّلة" count={facets?.statuses.funded} active={has('status', 'funded')} onClick={() => toggleCsv('status', 'funded')} />
      <Row label="تضمين المشاريع المنتهية" count={facets?.statuses.ended} active={ended} onClick={() => navigate({ includeEnded: ended ? undefined : '1' })} />
    </Section>
  );
}

/**
 * The category facet — a collapsible tree at ANY depth.
 *
 * The payload is a flat, pre-order array with a `depth` on each node, so
 * rendering a tree is a filter over "is every ancestor open", not a recursive
 * component. That is the whole reason the wire shape stayed flat: a nested
 * payload would have needed a recursive renderer AND a second traversal to work
 * out what is visible.
 *
 * Selection is by `catParam` (the '.'-joined path), not by bare slug. Eight
 * subcategory slugs repeat across different parents, so `?cat=events` used to
 * match every homonym at once and light all of them up in this list. A
 * path-qualified value names exactly one node. Bare slugs still resolve
 * server-side, so old links keep working — they simply co-highlight until the
 * reader's first click rewrites the URL.
 */
function CategorySection({ facets, has, toggleCsv }: {
  facets: ApiDiscoverFacets | null; has: (k: string, v: string) => boolean; toggleCsv: (k: string, v: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  /** Which parents are open, by path. Top level is always open. */
  const [open, setOpen] = useState<Set<string>>(new Set());
  const rows = facets?.categories ?? [];

  const isVisible = (r: ApiCategoryFacetNode): boolean => {
    if (r.depth === 0) return true;
    // Every ancestor must be open. The path is '/'-joined, so the ancestors are
    // its prefixes — no lookup table needed.
    const parts = r.path.split('/');
    for (let i = 1; i < parts.length; i += 1) {
      if (!open.has(parts.slice(0, i).join('/'))) return false;
    }
    return true;
  };

  // Collapsed: top level only, capped. Expanded: the tree, honouring `open`.
  const shown = expanded
    ? rows.filter(isVisible)
    : rows.filter((r) => r.depth === 0).slice(0, 8);

  const toggleOpen = (path: string): void =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        // Closing a node closes its subtree with it, or reopening the parent
        // would restore a state the reader cannot see and did not choose.
        for (const p of next) if (p === path || p.startsWith(`${path}/`)) next.delete(p);
      } else {
        next.add(path);
      }
      return next;
    });

  return (
    <Section title="الفئة">
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {shown.map((r) => (
          <div
            key={r.path}
            style={{ display: 'flex', alignItems: 'center', gap: 4, paddingInlineStart: r.depth * 14 }}
          >
            {expanded && r.hasChildren ? (
              <button
                type="button"
                onClick={() => toggleOpen(r.path)}
                aria-expanded={open.has(r.path)}
                aria-label={`${open.has(r.path) ? 'طيّ' : 'توسيع'} ${r.nameAr}`}
                style={{
                  border: 0, background: 'none', cursor: 'pointer', color: 'var(--muted2)',
                  // 24x24 target per WCAG 2.2 SC 2.5.8 without a 24px glyph.
                  width: 24, height: 24, display: 'grid', placeItems: 'center',
                  fontSize: 11, lineHeight: 1, flex: '0 0 auto',
                }}
              >
                {open.has(r.path) ? '▾' : '◂'}
              </button>
            ) : (
              // Keeps the labels on one optical line whether or not a node has
              // children — a ragged start edge reads as a rendering fault.
              <span aria-hidden style={{ width: expanded ? 24 : 0, flex: '0 0 auto' }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Row
                label={r.nameAr}
                count={r.count}
                active={has('cat', r.catParam)}
                onClick={() => toggleCsv('cat', r.catParam)}
                testId={`cat-${r.slug}`}
              />
            </div>
          </div>
        ))}
      </div>
      {rows.length > 8 && (
        <button type="button" onClick={() => setExpanded((v) => !v)} style={moreBtn}>
          {expanded ? 'عرض أقل' : 'عرض المزيد'}
        </button>
      )}
    </Section>
  );
}

/**
 * Tags — the axis the category tree cannot express.
 *
 * OR within the group, like categories: tags are cross-cutting by design, so
 * ANDing them would almost always return nothing. Server-capped at 30 and
 * ordered by count, so the section leads with the vocabulary the platform
 * actually uses rather than with the alphabet.
 */
function TagSection({ facets, has, toggleCsv }: {
  facets: ApiDiscoverFacets | null; has: (k: string, v: string) => boolean; toggleCsv: (k: string, v: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const rows = facets?.tags ?? [];
  if (rows.length === 0) return null;
  const shown = expanded ? rows : rows.slice(0, 8);
  return (
    <Section title="الوسوم">
      {shown.map((t) => (
        <Row
          key={t.slug}
          label={t.nameAr}
          count={t.count}
          active={has('tag', t.slug)}
          onClick={() => toggleCsv('tag', t.slug)}
          testId={`tag-${t.slug}`}
        />
      ))}
      {rows.length > 8 && (
        <button type="button" onClick={() => setExpanded((v) => !v)} style={moreBtn}>
          {expanded ? 'عرض أقل' : 'عرض المزيد'}
        </button>
      )}
    </Section>
  );
}

/**
 * Media and campaign length.
 *
 * Two small facets in one section because neither earns a heading of its own:
 * «فيديو» is a single toggle, and the duration buckets are narrow enough today
 * that a dedicated section would read as mostly empty.
 */
function MediaAndLengthSection({ facets, sp, navigate }: {
  facets: ApiDiscoverFacets | null; sp: SP; navigate: (n: SP) => void;
}) {
  const video = facets?.video ?? 0;
  const dur = facets?.duration ?? {};
  const anyDuration = DURATION_OPTS.some((o) => (dur[o.key] ?? 0) > 0);
  if (video === 0 && !anyDuration) return null;
  return (
    <Section title="الوسائط والمدة">
      {video > 0 && (
        <Row
          label="يحتوي على فيديو"
          count={video}
          active={sp.hasVideo === '1'}
          onClick={() => navigate({ hasVideo: sp.hasVideo === '1' ? undefined : '1' })}
          testId="has-video"
        />
      )}
      {anyDuration &&
        DURATION_OPTS.map((o) => (
          <Row
            key={o.key}
            kind="radio"
            label={o.labelAr}
            count={dur[o.key] ?? 0}
            active={sp.duration === o.key}
            onClick={() => navigate({ duration: sp.duration === o.key ? undefined : o.key })}
            testId={`duration-${o.key}`}
          />
        ))}
    </Section>
  );
}

function LocationSection({ facets, sp, navigate }: {
  facets: ApiDiscoverFacets | null; sp: SP; navigate: (n: SP) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cur = sp.region;
  const list = expanded ? REGIONS : REGIONS.filter((r) => QUICK_REGIONS.includes(r.key));
  return (
    <Section title="الموقع">
      <Row label="أي مكان" active={!cur} onClick={() => navigate({ region: undefined })} kind="radio" />
      {list.map((r) => (
        <Row
          key={r.key}
          label={r.ar}
          count={facets?.regions?.[r.key]}
          active={cur === r.key}
          onClick={() => navigate({ region: cur === r.key ? undefined : r.key })}
          kind="radio"
        />
      ))}
      <button type="button" onClick={() => setExpanded((v) => !v)} style={moreBtn}>
        {expanded ? 'عرض أقل' : 'كل المناطق'}
      </button>
    </Section>
  );
}

function MoneySection({ title, paramMin, paramMax, counts, sp, navigate }: {
  title: string; paramMin: string; paramMax: string; counts?: Record<string, number>; sp: SP; navigate: (n: SP) => void;
}) {
  const [min, setMin] = useState(sp[paramMin] ?? '');
  const [max, setMax] = useState(sp[paramMax] ?? '');
  useEffect(() => { setMin(sp[paramMin] ?? ''); setMax(sp[paramMax] ?? ''); }, [sp, paramMin, paramMax]);

  const activeBracket = (b: { min?: number; max?: number }): boolean =>
    String(b.min ?? '') === (sp[paramMin] ?? '') && String(b.max ?? '') === (sp[paramMax] ?? '');

  return (
    <Section title={title}>
      {MONEY_BRACKETS.map((b) => (
        <Row
          key={b.key}
          label={b.ar}
          count={counts?.[b.key]}
          active={activeBracket(b)}
          kind="radio"
          onClick={() =>
            activeBracket(b)
              ? navigate({ [paramMin]: undefined, [paramMax]: undefined })
              : navigate({ [paramMin]: b.min ? String(b.min) : undefined, [paramMax]: b.max ? String(b.max) : undefined })
          }
        />
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input inputMode="numeric" placeholder="من" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} style={miniInput} aria-label={`${title} الحد الأدنى`} />
        <input inputMode="numeric" placeholder="إلى" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} style={miniInput} aria-label={`${title} الحد الأعلى`} />
        <button type="button" onClick={() => navigate({ [paramMin]: min || undefined, [paramMax]: max || undefined })} style={applyBtn}>تطبيق</button>
      </div>
    </Section>
  );
}

function PctSection({ facets, sp, navigate }: { facets: ApiDiscoverFacets | null; sp: SP; navigate: (n: SP) => void }) {
  const cur = sp.pct;
  return (
    <Section title="نسبة التمويل">
      {PCT_OPTS.map((o) => (
        <Row
          key={o.key}
          label={o.ar}
          count={facets?.pct?.[o.key]}
          active={cur === o.key}
          kind="radio"
          onClick={() => navigate({ pct: cur === o.key ? undefined : o.key })}
          testId={`pct-${o.key}`}
        />
      ))}
    </Section>
  );
}

function ShowOnlySection({ facets, has, toggleCsv, signedIn }: {
  facets: ApiDiscoverFacets | null; has: (k: string, v: string) => boolean; toggleCsv: (k: string, v: string) => void; signedIn: boolean;
}) {
  return (
    <Section title="عرض فقط">
      {/* DECISION — this group is AND, unlike «الحالة» and «الفئة» which are OR,
          and the two look identical because both are checkboxes. Rather than
          flip the semantics, the label now says which it is.

          AND is the RIGHT behaviour here and OR would be the bug: «عرض فقط»
          narrows, so ticking «مختارات وثبة» and «المشاريع المحفوظة» should mean
          "staff picks that I also saved". Flipping to OR would silently widen
          every existing bookmarked URL that ticks two boxes. What was actually
          broken was that nothing told the reader. */}
      <div style={{ fontSize: 11.5, color: 'var(--muted2)', margin: '-4px 0 6px' }}>
        تُطبَّق مجتمعةً — كل خيار يضيّق النتائج
      </div>
      <Row label="مختارات وثبة" count={facets?.staff} active={has('only', 'staff')} onClick={() => toggleCsv('only', 'staff')} testId="only-staff" />
      {signedIn && <Row label="موصى بها لك" active={has('only', 'recommended')} onClick={() => toggleCsv('only', 'recommended')} testId="only-recommended" />}
      {signedIn && <Row label="المشاريع المحفوظة" active={has('only', 'saved')} onClick={() => toggleCsv('only', 'saved')} testId="only-saved" />}
    </Section>
  );
}

function CampaignsSection({ facets, sp, navigate }: { facets: ApiDiscoverFacets | null; sp: SP; navigate: (n: SP) => void }) {
  const [expanded, setExpanded] = useState(false);
  const rows = facets?.collections ?? [];
  if (rows.length === 0) return null;
  const shown = expanded ? rows : rows.slice(0, 5);
  const cur = sp.collection;
  return (
    <Section title="حملات وثبة">
      {shown.map((r) => (
        <Row
          key={r.slug}
          label={r.nameAr}
          count={r.count}
          active={cur === r.slug}
          kind="radio"
          onClick={() => navigate({ collection: cur === r.slug ? undefined : r.slug })}
        />
      ))}
      {rows.length > 5 && (
        <button type="button" onClick={() => setExpanded((v) => !v)} style={moreBtn}>
          {expanded ? 'عرض أقل' : 'عرض المزيد'}
        </button>
      )}
    </Section>
  );
}

/* ---------- styles -------------------------------------------------------- */
const emptyBox: React.CSSProperties = {
  textAlign: 'center', padding: '60px 24px', background: 'var(--card)',
  border: '1px dashed rgba(var(--ink-rgb),.14)', borderRadius: 20, color: 'var(--muted)',
};
const moreBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 12.5, fontWeight: 600, color: 'var(--accent-ink)', padding: '6px 6px', marginTop: 2,
};
const miniInput: React.CSSProperties = {
  width: 0, flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '7px 8px', borderRadius: 8,
  border: '1px solid rgba(var(--ink-rgb),.14)', background: 'rgba(var(--ink-rgb),.04)',
  fontFamily: 'inherit', fontSize: 12.5, color: 'var(--text)',
};
const applyBtn: React.CSSProperties = {
  border: 'none', cursor: 'pointer', background: 'rgba(var(--accent-rgb),.12)', color: 'var(--accent-ink)',
  fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, padding: '7px 12px', borderRadius: 8,
};
const resetBtn: React.CSSProperties = {
  marginTop: 14, border: '1px solid rgba(var(--ink-rgb),.14)', cursor: 'pointer',
  background: 'transparent', color: 'var(--accent-ink)', fontFamily: 'inherit', fontSize: 13,
  fontWeight: 600, padding: '8px 16px', borderRadius: 10,
};
function loadMoreBtn(loading: boolean): React.CSSProperties {
  return {
    border: 'none', cursor: loading ? 'default' : 'pointer', background: 'var(--grad)',
    color: 'var(--on-accent)', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
    padding: '12px 28px', borderRadius: 13, opacity: loading ? 0.7 : 1,
  };
}


/**
 * "هل تقصد…" — the zero state's second chance.
 *
 * Trigram nearest-neighbour over project titles, categories and tags, fetched
 * only when there are no results. A reader who mistypes one letter of an Arabic
 * word currently gets a blank page and a row of generic chips; the letter they
 * meant is one click away and the database already knows it.
 *
 * Client-side and after paint, deliberately: this must never delay the results
 * page itself, and on the far more common non-empty render it does not run at
 * all.
 */
function DidYouMean({ q }: { q: string }) {
  const [sug, setSug] = useState<{
    terms: string[];
    categories: Array<{ slug: string; nameAr: string }>;
    tags: Array<{ slug: string; nameAr: string }>;
  } | null>(null);

  useEffect(() => {
    let live = true;
    void fetch(`/api/search/did-you-mean?q=${encodeURIComponent(q)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (live) setSug(j as typeof sug);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [q]);

  const items = [
    ...(sug?.terms ?? []).map((t) => ({ label: t, href: `/projects/search?q=${encodeURIComponent(t)}` })),
    ...(sug?.categories ?? []).map((c) => ({ label: c.nameAr, href: `/projects/discover-all?cat=${encodeURIComponent(c.slug)}` })),
    ...(sug?.tags ?? []).map((t) => ({ label: t.nameAr, href: `/projects/discover-all?tag=${encodeURIComponent(t.slug)}` })),
  ];
  if (items.length === 0) return null;

  return (
    <div data-testid="did-you-mean" style={{ marginTop: 14 }}>
      <div style={{ fontSize: 13, color: 'var(--muted2)', marginBottom: 8 }}>هل تقصد…</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {items.slice(0, 6).map((it) => (
          <a
            key={it.href}
            href={it.href}
            style={{
              fontSize: 12.5, fontWeight: 600, color: 'var(--accent-ink)', textDecoration: 'none',
              border: '1px solid rgba(var(--accent-rgb),.28)', background: 'rgba(var(--accent-rgb),.08)',
              padding: '6px 13px', borderRadius: 999, maxWidth: 280,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {it.label}
          </a>
        ))}
      </div>
    </div>
  );
}
