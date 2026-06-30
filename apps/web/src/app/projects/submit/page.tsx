import type { Metadata } from 'next';

import { SubmissionWizard } from '@/components/ventures/submission-wizard';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';

export const metadata: Metadata = { title: 'إطلاق مشروع · وثبة' };

export default async function ProjectsSubmitPage({
  searchParams,
}: {
  searchParams?: Promise<{ err?: string }>;
}): Promise<React.ReactElement> {
  const params = (await searchParams) ?? {};
  return (
    <WathbaShell>
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px 80px' }}>
        <SubmissionWizard initialError={params.err} />
      </main>
    </WathbaShell>
  );
}
