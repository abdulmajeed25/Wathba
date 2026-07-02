import type { Metadata } from 'next';
import Link from 'next/link';

import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'تم الدعم بنجاح · وثبة' };

/**
 * Payment-return landing (Sprint 1 / P0-201).
 *
 * Reached two ways:
 *   1. In-page redirect after a successful stub/no-3DS pledge.
 *   2. Moyasar `callback_url` after a 3DS hop — Moyasar appends
 *      ?id=<payment>&status=<paid|authorized|failed>&message=… ; anything
 *      that is not authorized/paid bounces to the failure screen with the
 *      PSP message preserved.
 */
export default async function BackSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ id?: string; status?: string; message?: string; ref?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  if (sp.status && sp.status !== 'authorized' && sp.status !== 'paid') {
    redirect(
      `/projects/${id}/back/failure?message=${encodeURIComponent(sp.message ?? sp.status)}`,
    );
  }
  const ref = sp.ref ?? sp.id ?? null;

  return (
    <WathbaShell>
    <div className="wathba-fade" style={{ textAlign: 'center', padding: '90px 26px 120px' }}>
      <div
        style={{
          width: 90,
          height: 90,
          borderRadius: '50%',
          background: 'var(--grad)',
          display: 'grid',
          placeItems: 'center',
          margin: '0 auto 24px',
          boxShadow: '0 0 50px -10px rgba(var(--accent-rgb),.6)',
        }}
      >
        <span style={{ fontSize: 44, color: 'var(--on-accent)' }}>✓</span>
      </div>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 12 }}>شكراً لدعمك! 🎉</h1>
      <p
        style={{
          fontSize: 16,
          color: 'var(--text-soft)',
          maxWidth: 460,
          margin: '0 auto 10px',
          lineHeight: 1.7,
        }}
      >
        تم حجز مبلغ دعمك بنجاح. لن يُخصم إلا إذا بلغ المشروع هدف تمويله —
        وإن لم يبلغه يُعاد إليك تلقائياً بالكامل.
      </p>
      {ref && (
        <p style={{ fontSize: 12.5, color: 'var(--muted2)', marginBottom: 26 }}>
          رقم العملية: <span style={{ fontFamily: '"Space Grotesk", monospace' }}>{ref}</span>
        </p>
      )}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 18 }}>
        <Link
          href="/projects/me/pledges"
          style={{
            background: 'var(--grad)',
            color: 'var(--on-accent)',
            fontWeight: 700,
            fontSize: 15,
            padding: '13px 24px',
            borderRadius: 13,
            textDecoration: 'none',
          }}
        >
          مكفوفاتي
        </Link>
        <Link
          href={`/projects/${id}`}
          style={{
            background: 'transparent',
            border: '1px solid rgba(var(--ink-rgb),.16)',
            color: 'var(--text)',
            fontWeight: 600,
            fontSize: 15,
            padding: '13px 24px',
            borderRadius: 13,
            textDecoration: 'none',
          }}
        >
          عودة للمشروع
        </Link>
      </div>
    </div>
    </WathbaShell>
  );
}
