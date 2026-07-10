import type { Metadata } from 'next';

import { WathbaTabCreator } from '@/components/ventures/wathba/wathba-tab-creator';
import { campaignTabMetadata, resolveLiveProject } from '@/lib/campaign-tab-meta';

/** TABS — المبدع tab route (fetches only its own slice; shell in layout). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return campaignTabMetadata(id, 'المبدع', 'creator', 'تعرّف على مبدع الحملة: نبذة موثّقة عبر نفاذ، مشاريعه الأخرى، وطرق التواصل.');
}

export const revalidate = 60;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await resolveLiveProject(id);
  return <WathbaTabCreator id={id} project={project} />;
}
