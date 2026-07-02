import type { Metadata } from 'next';

import { getMyBeneficiary, listMyPayouts, listProjectMilestones } from '@/lib/api/wathba';
import { WathbaDashboardPayouts } from '@/components/ventures/wathba/dashboard/wathba-dashboard-payouts';
import { WathbaBeneficiaryForm } from '@/components/ventures/wathba/dashboard/wathba-beneficiary-form';

export const metadata: Metadata = { title: 'الدفعات والضمان · وثبة' };
export const dynamic = 'force-dynamic';

/**
 * Creator escrow/payout status (Sprint 3 / P1-208): every released tranche
 * with its disbursement state and ZATCA invoice number.
 */
export default async function DashboardPayoutsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [payouts, milestones, beneficiary] = await Promise.all([
    listMyPayouts(),
    listProjectMilestones(id),
    getMyBeneficiary(),
  ]);
  const rows = (payouts?.items ?? []).filter((p) => p.projectId === id);
  return (
    <>
      <WathbaBeneficiaryForm current={beneficiary} />
      <WathbaDashboardPayouts
        projectId={id}
        payouts={rows}
        milestones={milestones ?? []}
      />
    </>
  );
}
