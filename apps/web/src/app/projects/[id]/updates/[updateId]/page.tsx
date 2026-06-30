import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getProjectDetail, getProjectUpdate } from '@/lib/api/wathba';

/**
 * Public update permalink — Tier 2.4 rewrite.
 *
 * Reads from the live API (GET /v1/projects/:id/updates/:uid) instead of the
 * old fixture lookup that 404'd on every real project. ISR 60s.
 */

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; updateId: string }>;
}): Promise<Metadata> {
  const { id, updateId } = await params;
  const update = await getProjectUpdate(id, updateId);
  return {
    title: update ? `${update.titleAr} · وثبة` : `تحديث ${updateId.slice(0, 8)} · وثبة`,
  };
}

function formatDateAr(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default async function ProjectUpdatePage({
  params,
}: {
  params: Promise<{ id: string; updateId: string }>;
}): Promise<React.ReactElement> {
  const { id, updateId } = await params;
  const [project, update] = await Promise.all([
    getProjectDetail(id),
    getProjectUpdate(id, updateId),
  ]);
  if (!update) notFound();

  return (
    <main
      dir="rtl"
      style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: '40px 24px 80px',
        fontFamily: 'inherit',
      }}
    >
      <Link
        href={`/projects/${id}#updates`}
        style={{
          fontSize: 13,
          color: 'var(--muted)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 20,
          textDecoration: 'none',
        }}
      >
        ← العودة إلى التحديثات
      </Link>

      <header style={{ marginBottom: 28 }}>
        {project && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
            {project.titleAr}
          </div>
        )}
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--accent)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 6,
          }}
        >
          تحديث #{update.orderNum}
        </div>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            lineHeight: 1.25,
            color: 'var(--text)',
            marginBottom: 10,
          }}
        >
          {update.titleAr}
        </h1>
        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--muted)' }}>
          <span>{formatDateAr(update.date)}</span>
          <span>♥ {update.likeCount}</span>
          <span>💬 {update.commentCount}</span>
        </div>
      </header>

      <article
        style={{
          fontSize: 16,
          lineHeight: 1.85,
          color: 'var(--text)',
          whiteSpace: 'pre-wrap',
        }}
      >
        {update.bodyAr}
      </article>
    </main>
  );
}
