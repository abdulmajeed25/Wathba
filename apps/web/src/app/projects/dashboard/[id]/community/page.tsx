import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { getCommunitySnapshot, type ApiCommunitySnapshot } from '@/lib/api/wathba';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/**
 * Creator dashboard "المجتمع" (Community) panel — read-only insight surface
 * over CommunityStat (city / country buckets, new vs returning backers)
 * plus a "rebuild" action that recomputes from CAPTURED pledges.
 *
 * The rebuild action proxies through the bearer cookie so the creator can
 * trigger a recompute without leaving the page. SSR — snapshot fetched on
 * each render; rebuild + revalidatePath() forces the next paint to be live.
 */
export default async function CommunityDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const snapshot = await getCommunitySnapshot(id);

  async function rebuild(): Promise<void> {
    'use server';
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) return;
    try {
      await fetch(`${API_BASE}/v1/projects/${id}/community/rebuild`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
    } catch {
      /* swallow; UI just won't show new numbers */
    }
    revalidatePath(`/projects/dashboard/${id}/community`);
  }

  return (
    <>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 6 }}>المجتمع</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary, #3b4942)', margin: 0 }}>
          إحصاءات الداعمين — جغرافياً (المدن والدول) ونسبة الجدد إلى العائدين.
        </p>
      </header>

      <TotalsRow snapshot={snapshot} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <RankedTable
          title="أهم المدن"
          rows={snapshot?.topCities ?? []}
          emptyText="لا توجد بيانات شحن بعد."
        />
        <RankedTable
          title="أهم الدول"
          rows={snapshot?.topCountries ?? []}
          emptyText="لم يصلنا داعمون من خارج المملكة بعد."
        />
      </div>

      <form action={rebuild}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            background: 'var(--bg-elevated, #fff)',
            border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
            borderRadius: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
              إعادة احتساب الإحصاءات
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary, #5d6b62)' }}>
              يُعيد بناء الجداول من جميع التعهدات المُحصَّلة. استخدمه عند الشك بانحراف الأرقام.
            </div>
          </div>
          <button
            type="submit"
            style={{
              padding: '10px 18px',
              background: 'var(--brand-primary, #05a661)',
              color: '#fff',
              border: 0,
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            إعادة الاحتساب
          </button>
        </div>
      </form>
    </>
  );
}

function TotalsRow({
  snapshot,
}: {
  snapshot: ApiCommunitySnapshot | null;
}): React.ReactElement {
  const total = snapshot?.totals.total ?? 0;
  const newCount = snapshot?.totals.newCount ?? 0;
  const returningCount = snapshot?.totals.returningCount ?? 0;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 16,
        marginBottom: 24,
      }}
    >
      <StatCard label="إجمالي الداعمين" value={fmt(total)} accent />
      <StatCard label="داعمون جدد" value={fmt(newCount)} sub="أول دعم لهم على وثبة" />
      <StatCard
        label="داعمون عائدون"
        value={fmt(returningCount)}
        sub="دعموا مشاريع أخرى من قبل"
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}): React.ReactElement {
  return (
    <div
      style={{
        background: 'var(--bg-elevated, #fff)',
        border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--text-tertiary, #5d6b62)', marginBottom: 8 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: accent ? 'var(--brand-primary, #05a661)' : 'var(--text-primary, #16201b)',
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{ fontSize: 11, color: 'var(--text-tertiary, #5d6b62)', marginTop: 8 }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function RankedTable({
  title,
  rows,
  emptyText,
}: {
  title: string;
  rows: ReadonlyArray<{ key: string; backers: number }>;
  emptyText: string;
}): React.ReactElement {
  const max = rows.reduce((acc, r) => Math.max(acc, r.backers), 0);
  return (
    <div
      style={{
        background: 'var(--bg-elevated, #fff)',
        border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{title}</div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-tertiary, #5d6b62)' }}>{emptyText}</div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {rows.map((r) => (
            <li
              key={r.key}
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr 60px',
                alignItems: 'center',
                gap: 12,
                padding: '6px 0',
                fontSize: 13,
              }}
            >
              <span style={{ color: 'var(--text-primary, #16201b)' }}>{r.key}</span>
              <span
                style={{
                  height: 6,
                  background: 'rgba(5,166,97,0.16)',
                  borderRadius: 999,
                  overflow: 'hidden',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    height: '100%',
                    width: `${max > 0 ? (r.backers / max) * 100 : 0}%`,
                    background: 'var(--brand-primary, #05a661)',
                  }}
                />
              </span>
              <span
                style={{
                  textAlign: 'end',
                  fontWeight: 600,
                  color: 'var(--text-primary, #16201b)',
                }}
              >
                {fmt(r.backers)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}
