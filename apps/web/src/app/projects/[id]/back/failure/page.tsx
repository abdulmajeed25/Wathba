import type { Metadata } from 'next';
import Link from 'next/link';

import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';

export const metadata: Metadata = { title: 'تعذّر إتمام الدفع · وثبة' };

/**
 * Payment-failure landing (Sprint 1 / P0-201).
 * Reached from an inline pledge failure or a Moyasar 3DS callback with a
 * non-authorized status. Nothing was charged — holds either failed or were
 * never placed. Offers a retry back into the pledge flow.
 */
export default async function BackFailurePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  return (
    <WathbaShell>
    <div className="wathba-fade" style={{ textAlign: 'center', padding: '90px 26px 120px' }}>
      <div
        style={{
          width: 90,
          height: 90,
          borderRadius: '50%',
          background: 'rgba(239,68,68,.12)',
          border: '2px solid rgba(239,68,68,.4)',
          display: 'grid',
          placeItems: 'center',
          margin: '0 auto 24px',
        }}
      >
        <span style={{ fontSize: 40, color: '#ef4444' }}>✕</span>
      </div>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 12 }}>تعذّر إتمام الدفع</h1>
      <p
        style={{
          fontSize: 16,
          color: 'var(--text-soft)',
          maxWidth: 460,
          margin: '0 auto 10px',
          lineHeight: 1.7,
        }}
      >
        لم يُخصم أي مبلغ من بطاقتك. تحقق من بيانات البطاقة أو جرّب وسيلة دفع
        أخرى ثم أعد المحاولة.
      </p>
      {sp.message && (
        <p
          style={{
            fontSize: 12.5,
            color: '#ef4444',
            maxWidth: 460,
            margin: '0 auto 26px',
            direction: 'ltr',
          }}
        >
          {sp.message}
        </p>
      )}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 18 }}>
        <Link
          href={`/projects/${id}/back`}
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
          إعادة المحاولة
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
