import type { Metadata } from 'next';

import { WathbaTabTransparency } from '@/components/ventures/wathba/wathba-tab-transparency';
import { campaignTabMetadata, resolveLiveProject } from '@/lib/campaign-tab-meta';

/** TABS — الشفافية tab route (fetches only its own slice; shell in layout). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return campaignTabMetadata(id, 'الشفافية', 'transparency', 'لوحة الشفافية الحية: أين يُصرف التمويل مرحلةً بمرحلة من حساب الضمان.');
}

export const revalidate = 30;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await resolveLiveProject(id);
  return <WathbaTabTransparency id={id} project={project} />;
}
