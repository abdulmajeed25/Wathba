import type { Metadata } from 'next';
import Link from 'next/link';

import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { listProjectUpdates } from '@/lib/api/wathba';

export const metadata: Metadata = { title: 'تحديثات الحملة · وثبة' };
export const revalidate = 30;

/**
 * Public updates index for a project (fixes the Part-1 404 — the route only had
 * /updates/[updateId]). Lists published updates newest-first; backer-only bodies
 * are withheld from non-backers by the API.
 */
export default async function ProjectUpdatesIndexPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const updates = (await listProjectUpdates(id))?.items ?? [];

  return (
    <WathbaShell>
      <div dir="rtl" style={{ maxWidth: 760, margin: '0 auto', padding: '24px 20px' }}>
        <div style={{ marginBottom: 20 }}>
          <Link href={`/projects/${id}`} style={{ fontSize: 13, color: 'var(--brand-primary, #05a661)', textDecoration: 'none' }}>
            ← العودة للحملة
          </Link>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: '8px 0 0' }}>تحديثات الحملة</h1>
        </div>

        {updates.length === 0 ? (
          <div style={{ padding: 24, borderRadius: 12, textAlign: 'center', fontSize: 14, color: 'var(--text-secondary, #3b4942)', background: 'var(--bg-elevated, #fff)', border: '1px dashed rgba(18,33,26,0.16)' }}>
            لا توجد تحديثات منشورة بعد.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {updates.map((u) => (
              <Link
                key={u.id}
                href={`/projects/${id}/updates/${u.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <article style={{ background: 'var(--bg-elevated, #fff)', border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand-primary, #05a661)' }}>#{u.orderNum}</span>
                    <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{u.titleAr}</h2>
                    {u.locked && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, color: '#a96400', background: 'rgba(245,158,11,0.12)' }}>
                        🔒 للداعمين
                      </span>
                    )}
                    <span style={{ marginInlineStart: 'auto', fontSize: 11.5, color: 'var(--text-tertiary, #5d6b62)' }}>
                      {new Date(u.date).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p style={{ fontSize: 13.5, color: 'var(--text-secondary, #3b4942)', margin: 0, lineHeight: 1.7, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {u.bodyAr ?? 'هذا التحديث مخصّص للداعمين — ادعم الحملة لقراءته.'}
                  </p>
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-tertiary, #5d6b62)' }}>
                    ❤ {u.likeCount} · 💬 {u.commentCount}
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </div>
    </WathbaShell>
  );
}
