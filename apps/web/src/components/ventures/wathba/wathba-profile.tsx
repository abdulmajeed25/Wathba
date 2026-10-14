import Link from 'next/link';
import type { ApiBackingRow, ApiSavedCard, ApiUserMe } from '@/lib/api/wathba';
import { Icon, Num } from './wathba-icons';
import { WathbaProfileCompleteness } from './wathba-profile-completeness';
import { EmptyState } from './wathba-states';
import { formatSarFromHalalas } from '@/lib/i18n/format';
interface SavedRow {
  id: string;
  href: string;
  cat: string;
  titleAr: string;
  creator: string;
  pct: number;
  pctW: string;
  barGrad: string;
  pctColor: string;
  daysLeft: number;
}

const SAVED_STATUS_AR: Record<string, string> = {
  LIVE: 'نشط',
  FUNDED: 'مموَّل',
  IN_PRODUCTION: 'قيد التنفيذ',
  DELIVERED: 'تم التسليم',
  PAUSED: 'متوقف مؤقتاً',
};

function savedCardToRow(c: ApiSavedCard): SavedRow {
  const pct = c.fundingGoalHalalas > 0
    ? Math.round((c.raisedHalalas / c.fundingGoalHalalas) * 100)
    : 0;
  const over = pct >= 100;
  const msLeft = c.deadline ? new Date(c.deadline).getTime() - Date.now() : 0;
  return {
    id: c.id,
    href: c.slug ? `/p/${c.slug}` : `/projects/${c.id}`,
    cat: SAVED_STATUS_AR[c.status] ?? c.status,
    titleAr: c.titleAr,
    creator: c.creatorName,
    pct,
    pctW: Math.min(pct, 100) + '%',
    pctColor: over ? 'var(--accent-ink)' : 'var(--blue)',
    barGrad: over ? 'var(--grad-bar-over)' : 'var(--grad-bar)',
    daysLeft: Math.max(0, Math.ceil(msLeft / 86_400_000)),
  };
}


export function WathbaProfile({ backings, saved, me, initialTab }: {
  backings?: ApiBackingRow[] | null; saved?: ApiSavedCard[] | null;
  me?: ApiUserMe | null; initialTab?: 'saved' | 'backed';
}) {
  const isSaved = initialTab === 'saved';
  return <section style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px 64px' }}>
    <p style={{ color: 'var(--muted)' }}>{me?.name ?? 'حسابك في وثبة'}</p>
    <h1 style={{ fontSize: 32, fontWeight: 700 }}>{isSaved ? 'المشاريع المحفوظة' : 'نشاطي'}</h1>
    <nav aria-label="حسابي" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, margin: '20px 0' }}>
      <Link href="/activity" aria-current={!isSaved ? 'page' : undefined}>نشاطي</Link>
      <Link href="/saved" aria-current={isSaved ? 'page' : undefined}>المحفوظة</Link>
      <Link href="/projects/me/pledges">إدارة تعهداتي</Link>
      <Link href="/projects/dashboard">مشاريعي وطلباتي</Link>
    </nav>
    {me && <WathbaProfileCompleteness me={me} />}
    {isSaved ? saved == null ? <LoadError /> : <SavedGrid projects={saved.map(savedCardToRow)} /> :
      backings == null ? <LoadError /> : backings.length === 0 ?
        <EmptyState icon="favorite" title="لم تدعم أي مشروع بعد" body="ستظهر هنا تعهداتك الفعلية بعد دعم مشروع." cta={<Link href="/projects/discover-all">اكتشف المشاريع</Link>} /> :
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 12 }}>
          {backings.map(row => <li key={row.id} style={{ padding: 20, borderRadius: 16, background: 'var(--card)', border: '1px solid var(--line)' }}>
            <Link href={`/projects/${row.ventureId}`} style={{ fontWeight: 700 }}>{row.venture?.title ?? 'عرض الحملة'}</Link>
            <p>{formatSarFromHalalas('ar', Number(row.amount))} · {new Date(row.committedAt).toLocaleDateString('ar-SA')}</p>
            <Link href="/projects/me/pledges">عرض حالة التعهد وإدارته</Link>
          </li>)}
        </ul>}
  </section>;
}
function LoadError() { return <div role="alert"><p>تعذّر تحميل البيانات. لم تُفقد بيانات حسابك.</p><a href="">إعادة المحاولة</a></div>; }
function SavedGrid({ projects }: { projects: SavedRow[] }) {
  if (projects.length === 0) {
    return (
      <EmptyState
        icon="bookmark"
        title="لا مشاريع محفوظة بعد"
        body="احفظ المشاريع التي تهمّك من صفحة الاستكشاف وستجدها هنا."
        cta={
          <Link href="/projects/discover-all" style={{ color: 'var(--accent-ink)', fontWeight: 700, textDecoration: 'none' }}>
            اكتشف المشاريع ←
          </Link>
        }
      />
    );
  }
  return (
    <div
      className="wathba-fade"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 18 }}
    >
      {projects.map((p) => (
        <Link
          key={p.id}
          href={p.href}
          className="lift"
          style={{
            cursor: 'pointer',
            background: 'var(--card)',
            border: '1px solid rgba(var(--ink-rgb),.08)',
            borderRadius: 18,
            overflow: 'hidden',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div className="wathba-ph" style={{ height: 140, position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                top: 11,
                left: 11,
                width: 30,
                height: 30,
                borderRadius: 9,
                background: 'rgba(6,18,31,.8)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Icon name="bookmark" size={17} fill color="var(--on-scrim-gold)" />
            </div>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Num className="num" style={{ fontSize: 11, color: 'var(--ph-label)' }}>
                [ {p.cat} ]
              </Num>
            </div>
          </div>
          <div style={{ padding: '15px 16px 17px' }}>
            <h3 style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 4 }}>{p.titleAr}</h3>
            <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 12 }}>
              بواسطة {p.creator}
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 30,
                background: 'rgba(var(--ink-rgb),.08)',
                overflow: 'hidden',
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: p.pctW,
                  background: p.barGrad,
                  borderRadius: 30,
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Num className="num" style={{ fontSize: 13, fontWeight: 700, color: p.pctColor }}>
                {p.pct}%
              </Num>
              <Num className="num" style={{ fontSize: 12, color: 'var(--muted2)' }}>
                {p.daysLeft} يوم
              </Num>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
