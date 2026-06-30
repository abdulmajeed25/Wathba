'use client';

import { useQuery } from '@tanstack/react-query';

import { type ApiCommunitySnapshot } from '@/lib/api/wathba';

/**
 * Public "المجتمع" tab on the project page — pretty cards + bars over the
 * same payload the dashboard panel uses. Client-side fetched via TanStack
 * Query so we get refetch-on-mount + a pulse-load skeleton when stats arrive
 * after the initial paint. Resilient: API failure → empty-state, never crashes.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

async function fetchSnapshot(projectId: string): Promise<ApiCommunitySnapshot | null> {
  const url = API_BASE
    ? `${API_BASE}/v1/projects/${projectId}/community`
    : `/v1/projects/${projectId}/community`;
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) return null;
    return (await res.json()) as ApiCommunitySnapshot;
  } catch {
    return null;
  }
}

export function WathbaCommunityTab({
  projectId,
  initialData,
}: {
  projectId: string;
  initialData?: ApiCommunitySnapshot | null;
}): React.ReactElement {
  const { data, isLoading } = useQuery({
    queryKey: ['community', projectId],
    queryFn: () => fetchSnapshot(projectId),
    initialData: initialData ?? undefined,
    staleTime: 60_000,
  });

  if (isLoading && !data) return <PulseLoad />;

  const snapshot = data ?? null;
  const total = snapshot?.totals.total ?? 0;
  const newCount = snapshot?.totals.newCount ?? 0;
  const returningCount = snapshot?.totals.returningCount ?? 0;

  return (
    <section dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, marginBottom: 4 }}>
          مجتمع الداعمين
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary, #3b4942)', margin: 0 }}>
          من أين يأتي داعمونا، وكم منهم جديد على وثبة.
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
        }}
      >
        <Card label="إجمالي الداعمين" value={fmt(total)} accent />
        <Card label="داعمون جدد" value={fmt(newCount)} hint="أول مشروع يدعمونه" />
        <Card
          label="داعمون عائدون"
          value={fmt(returningCount)}
          hint="دعموا قبل ذلك"
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
        }}
      >
        <Ranks
          title="أبرز المدن"
          rows={snapshot?.topCities ?? []}
          emptyText="لم تُسجَّل بيانات الشحن بعد."
        />
        <Ranks
          title="أبرز الدول"
          rows={snapshot?.topCountries ?? []}
          emptyText="السعودية فقط حتى الآن."
        />
      </div>
    </section>
  );
}

function Card({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}): React.ReactElement {
  return (
    <div
      style={{
        background: 'var(--bg-elevated, #fff)',
        border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text-tertiary, #5d6b62)', marginBottom: 6 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: accent ? 'var(--brand-primary, #05a661)' : 'var(--text-primary, #16201b)',
        }}
      >
        {value}
      </div>
      {hint && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary, #5d6b62)', marginTop: 4 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function Ranks({
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
        padding: 14,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{title}</div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary, #5d6b62)' }}>{emptyText}</div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {rows.slice(0, 5).map((r) => (
            <li
              key={r.key}
              style={{
                display: 'grid',
                gridTemplateColumns: '100px 1fr 50px',
                alignItems: 'center',
                gap: 10,
                padding: '4px 0',
                fontSize: 12,
              }}
            >
              <span>{r.key}</span>
              <span
                style={{
                  height: 5,
                  background: 'rgba(var(--accent-rgb), 0.16)',
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

function PulseLoad(): React.ReactElement {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
      }}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            height: 90,
            borderRadius: 12,
            background: 'linear-gradient(90deg, #eef1ed 0%, #f8faf6 50%, #eef1ed 100%)',
            animation: 'wathba-pulse 1.4s ease-in-out infinite',
          }}
        />
      ))}
      <style>{`@keyframes wathba-pulse { 0% { opacity: .6 } 50% { opacity: 1 } 100% { opacity: .6 } }`}</style>
    </div>
  );
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}
