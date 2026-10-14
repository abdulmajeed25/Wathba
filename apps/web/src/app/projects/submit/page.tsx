import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getProjectDetailLive } from '@/lib/api/wathba';
import { requireUser } from '@/lib/auth/guard';

import { SubmissionWizard } from '@/components/ventures/submission-wizard';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';

export const metadata: Metadata = { title: 'إطلاق مشروع · وثبة' };

export default async function ProjectsSubmitPage({
  searchParams,
}: {
  searchParams?: Promise<{ err?: string; draft?: string }>;
}): Promise<React.ReactElement> {
  const params = (await searchParams) ?? {};
  const me = await requireUser();
  const draft = params.draft ? await getProjectDetailLive(params.draft) : null;
  if (params.draft && (!draft || draft.createdBy !== me.id)) notFound();
  if (draft && (draft.status !== 'DRAFT' || draft.applicationApprovedAt)) redirect(`/projects/dashboard/${draft.id}`);
  return (
    <WathbaShell>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px 80px' }}>
        <SubmissionWizard initialError={params.err} initialProject={draft ?? undefined} />
      </div>
    </WathbaShell>
  );
}
