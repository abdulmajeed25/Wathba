import type { Metadata } from 'next';
import Link from 'next/link';

import { ShareRow } from '@/components/ventures/wathba/wathba-share';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { getProjectDetail, getMyPledgeResult } from '@/lib/api/wathba';
import { AuthorizationRecovery } from '@/components/ventures/wathba/authorization-recovery';

export const metadata: Metadata = { title: 'نتيجة الدعم · وثبة' };

/**
 * Payment-return landing (Sprint 1 / P0-201).
 *
 * Reached two ways:
 *   1. In-page redirect after a successful stub/no-3DS pledge.
 *   2. Provider callback. Query parameters identify the requested lookup;
 *      the authenticated account's stored pledge determines the message.
 */
export default async function BackSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ id?: string; status?: string; message?: string; ref?: string; pledge?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const ref = sp.ref ?? sp.id ?? null;
  // The API scopes this direct lookup to the authenticated backer. A stable
  // pledge ID survives replacement of the initial temporary PSP reference.
  const result = await getMyPledgeResult({ pledgeId: sp.pledge, paymentRef: ref ?? undefined });
  const pledge = result?.projectId === id ? { ...result, state: result.status } : null;
  const confirmed = pledge && ['HELD', 'CAPTURED', 'PENDING_BNPL'].includes(pledge.state);
  const heading = confirmed ? 'تم تسجيل دعمك' : pledge?.state === 'REFUNDED' ? 'تم رد المساهمة أو فك الحجز'
    : pledge?.state === 'FAILED' ? 'لم يكتمل الدفع' : 'جارٍ التحقق من حالة الدعم';
  const description = pledge?.state === 'HELD' ? 'تأكد حجز المبلغ وسُجّل تعهدك. يمكنك متابعة حالته وشروطه من صفحة تعهداتي.'
    : pledge?.state === 'CAPTURED' ? 'تأكد تحصيل المبلغ. تابع تفاصيل تعهدك وتحديثات المشروع من حسابك.'
      : pledge?.state === 'PENDING_BNPL' ? 'سُجل التزام التقسيط؛ لم يبدأ عقد التقسيط أو التحصيل بعد. تابع التعليمات من تعهداتي.'
        : pledge?.state === 'REFUNDED' ? 'سُجل رد المساهمة أو فك الحجز. راجع تعهداتي وتفاصيل وسيلة الدفع لمتابعة المبلغ.'
          : pledge?.state === 'FAILED' ? 'لم تُسجّل العملية دعمًا ناجحًا. راجع حالة تعهدك قبل بدء محاولة جديدة.'
            : 'لم نتأكد من اكتمال تسجيل الدعم بعد. راجع تعهداتي قبل إعادة الدفع لتجنب إنشاء محاولة إضافية.';

  // STAKES/S-10 F-04 (I3) — the share block needs the project title; degrade
  // to the generic platform line if the lookup fails (never block the thanks).
  const live = await getProjectDetail(id).catch(() => null);
  const shareTitle = live?.titleAr ?? 'مشروع على وثبة';
  const shareUrl = live?.slug ? `/p/${live.slug}` : `/projects/${id}`;

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
        <span style={{ fontSize: 44, color: 'var(--on-accent)' }}>{confirmed ? '✓' : '…'}</span>
      </div>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 12 }}>{heading}</h1>
      <p
        style={{
          fontSize: 16,
          color: 'var(--text-soft)',
          maxWidth: 460,
          margin: '0 auto 10px',
          lineHeight: 1.7,
        }}
      >
        {description}
      </p>
      {pledge?.authorizationRecoverable && <AuthorizationRecovery pledgeId={pledge.id} autoCheck />}
      {ref && (
        <p style={{ fontSize: 12.5, color: 'var(--muted2)', marginBottom: 26, overflowWrap: 'anywhere' }}>
          رقم العملية: <span style={{ fontFamily: '"Space Grotesk", monospace' }}>{ref}</span>
        </p>
      )}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
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
          تعهّداتي
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
      {confirmed && <div style={{ marginTop: 34 }}>
        <ShareRow title={shareTitle} url={shareUrl} />
      </div>}
    </div>
    </WathbaShell>
  );
}
