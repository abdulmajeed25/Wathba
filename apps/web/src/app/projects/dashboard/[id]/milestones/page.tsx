import { notFound } from 'next/navigation';

import {
  getProjectDetail,
  getProjectTransparency,
  listProjectMilestones,
  type ApiSpendLog,
} from '@/lib/api/wathba';
import { DashboardMilestonesManager } from '@/components/ventures/wathba/dashboard/wathba-dashboard-milestones-manager';

/**
 * Server component for the «المراحل والشفافية» dashboard section. Loads the
 * project (for status + raised total), the milestone plan, and the live
 * transparency payload, then hands them to the client manager.
 */
export default async function MilestonesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const [project, milestones, transparencyRaw] = await Promise.all([
    getProjectDetail(id),
    listProjectMilestones(id),
    getProjectTransparency(id),
  ]);
  if (!project) notFound();

  // The /v1 transparency endpoint actually returns
  //   { budget: { totalSpentHalalas, totalRaisedHalalas, rows: [{label, amountHalalas, pct}] },
  //     timeline: ApiSpendLog[] }
  // The historical SDK types `budget` as `ApiBudgetSplitRow[]`; narrow at the
  // boundary here without touching the shared SDK file.
  const transparency = transparencyRaw as unknown as {
    budget: {
      totalSpentHalalas: number;
      totalRaisedHalalas: number;
      rows: Array<{ label: string; amountHalalas: number; pct: number }>;
    };
    timeline: ApiSpendLog[];
  } | null;

  return (
    <DashboardMilestonesManager
      projectId={id}
      projectStatus={project.status}
      raisedHalalas={project.raisedHalalas}
      initialMilestones={milestones ?? []}
      initialBudget={transparency?.budget ?? { totalSpentHalalas: 0, totalRaisedHalalas: project.raisedHalalas, rows: [] }}
      initialSpendLog={transparency?.timeline ?? []}
    />
  );
}
