import type { Metadata } from 'next';

import { WathbaAdmin } from '@/components/ventures/wathba/wathba-admin';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { listKycQueue, listReviewQueue } from '@/lib/api/wathba';

export const metadata: Metadata = { title: 'الإدارة · وثبة' };

// No ISR — admin queues change with every approve/reject.
export const dynamic = 'force-dynamic';

export default async function AdminPage(): Promise<React.ReactElement> {
  // Middleware bounces anon callers to /sign-in. If the cookie holder isn't
  // an ADMIN, the API returns 403 and our SDK helpers return null; the UI
  // renders empty queues + the admin can't do anything (no broken state).
  const [review, kyc] = await Promise.all([listReviewQueue(), listKycQueue()]);
  return (
    <WathbaShell>
      <WathbaAdmin reviewQueue={review?.items ?? []} kycQueue={kyc?.items ?? []} />
    </WathbaShell>
  );
}
