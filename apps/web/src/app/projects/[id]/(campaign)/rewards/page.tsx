import type { Metadata } from 'next';

import { WathbaTabRewards } from '@/components/ventures/wathba/wathba-tab-rewards';
import { campaignTabMetadata, resolveLiveProject } from '@/lib/campaign-tab-meta';

/** TABS — المكافآت tab route (fetches only its own slice; shell in layout). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return campaignTabMetadata(id, 'المكافآت', 'rewards', 'مستويات المكافآت المتاحة لداعمي الحملة — اختر مكافأتك وادعم المشروع.');
}

export const revalidate = 60;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await resolveLiveProject(id);
  return <WathbaTabRewards id={id} project={project} />;
}
