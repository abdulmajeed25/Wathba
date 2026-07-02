import type { Metadata } from 'next';

import { WathbaDashboardRfqs } from '@/components/ventures/wathba/dashboard/wathba-dashboard-rfqs';
import { listProjectRfqs } from '@/lib/api/wathba';

export const metadata: Metadata = { title: 'طلبات التوريد · وثبة' };
export const dynamic = 'force-dynamic';

/**
 * Creator-side reverse-auction manager (Sprint 3 / P0-302): publish RFQs,
 * watch bids arrive sorted ascending, award the winning supplier.
 */
export default async function DashboardRfqsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rfqs = await listProjectRfqs(id);
  return <WathbaDashboardRfqs projectId={id} initialRfqs={rfqs} />;
}
