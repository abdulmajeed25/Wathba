import type { Metadata } from 'next';

import { WathbaAdmin } from '@/components/ventures/wathba/wathba-admin';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { getModerationQueue, listKycQueue, listReviewQueue } from '@/lib/api/wathba';
import { requireRole } from '@/lib/auth/guard';

export const metadata: Metadata = { title: 'الإدارة · وثبة' };

// No ISR — admin queues change with every approve/reject.
export const dynamic = 'force-dynamic';

export default async function AdminPage(): Promise<React.ReactElement> {
  // STAKES/B5 — ADMIN only, enforced server-side (was: any authed user rendered
  // the empty admin shell because API 403s degraded to null fixtures).
  await requireRole('ADMIN');
  const [review, kyc, moderation] = await Promise.all([
    listReviewQueue(),
    listKycQueue(),
    // STAKES/K2 K3 — reported comments + projects.
    getModerationQueue(),
  ]);
  return (
    <WathbaShell>
      <WathbaAdmin
        reviewQueue={review?.items ?? []}
        kycQueue={kyc?.items ?? []}
        moderation={moderation ?? { comments: [], projects: [] }}
      />
    </WathbaShell>
  );
}
