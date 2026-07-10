import type { Metadata } from 'next';

import { WathbaTabComments } from '@/components/ventures/wathba/wathba-tab-comments';
import { campaignTabMetadata, resolveLiveProject } from '@/lib/campaign-tab-meta';

/** TABS — التعليقات tab route (fetches only its own slice; shell in layout). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return campaignTabMetadata(id, 'التعليقات', 'comments', 'نقاش الداعمين مع المبدع: التعليقات والردود الموثّقة على الحملة.');
}

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await resolveLiveProject(id);
  return <WathbaTabComments id={id} project={project} />;
}
