import { FaqManager } from '@/components/ventures/wathba/dashboard/wathba-dashboard-faq-manager';
import { listFaqItems, listFaqQuestions } from '@/lib/api/wathba';

export default async function FaqPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const [items, questions] = await Promise.all([listFaqItems(id), listFaqQuestions(id)]);
  return (
    <FaqManager
      projectId={id}
      initialItems={items ?? []}
      initialQuestions={questions ?? []}
    />
  );
}
