import type { Metadata } from 'next';

import { WathbaTabCommunity } from '@/components/ventures/wathba/wathba-tab-community';
import { campaignTabMetadata, resolveLiveProject } from '@/lib/campaign-tab-meta';

/** TABS — المجتمع tab route (fetches only its own slice; shell in layout). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return campaignTabMetadata(id, 'المجتمع', 'community', 'مجتمع الحملة: التوزيع الجغرافي للداعمين ونسب الداعمين الجدد والعائدين.');
}

export const revalidate = 60;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await resolveLiveProject(id);
  return <WathbaTabCommunity id={id} project={project} />;
}
