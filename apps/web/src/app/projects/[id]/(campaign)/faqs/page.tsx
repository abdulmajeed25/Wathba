import type { Metadata } from 'next';

import { WathbaTabFaqs } from '@/components/ventures/wathba/wathba-tab-faqs';
import { campaignTabMetadata, resolveLiveProject } from '@/lib/campaign-tab-meta';

/** TABS — الأسئلة الشائعة tab route (fetches only its own slice; shell in layout). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return campaignTabMetadata(id, 'الأسئلة الشائعة', 'faqs', 'إجابات المبدع على أكثر أسئلة الداعمين شيوعاً — واسأل سؤالك بعد تسجيل الدخول.');
}

export const revalidate = 60;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await resolveLiveProject(id);
  return <WathbaTabFaqs id={id} project={project} />;
}
