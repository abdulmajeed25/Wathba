'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import type { ApiDiscoverAllResult, ApiDiscoverCard, ApiDiscoverFacets } from '@/lib/api/wathba';
import { Icon } from './wathba-icons';
import { WathbaDiscoverAllCard } from './wathba-discover-all-card';
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
          <LocationSection facets={facets} sp={sp} navigate={navigate} />
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
                {q ? `لا نتائج عن «${q}» — جرّب فئة أخرى.` : 'لا توجد مشاريع مطابقة لعوامل التصفية.'}
              </div>
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

function CategorySection({ facets, has, toggleCsv }: {
  facets: ApiDiscoverFacets | null; has: (k: string, v: string) => boolean; toggleCsv: (k: string, v: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const rows = facets?.categories ?? [];
  const shown = expanded ? rows : rows.filter((r) => !r.parentSlug).slice(0, 8);
  return (
    <Section title="الفئة">
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {shown.map((r) => (
          <div key={`${r.parentSlug ?? ''}/${r.slug}`} style={{ paddingInlineStart: r.parentSlug ? 16 : 0 }}>
            <Row
              label={r.parentSlug ? `↳ ${r.nameAr}` : r.nameAr}
              count={r.count}
              active={has('cat', r.slug)}
              onClick={() => toggleCsv('cat', r.slug)}
              testId={`cat-${r.slug}`}
            />
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
