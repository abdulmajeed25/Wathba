import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { UpdatePermalinkView } from '@/components/ventures/update-permalink-view';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { getLocale } from '@/lib/i18n/server';
import { getVentureDetail } from '@/lib/ventures/fixtures';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; updateId: string }>;
}): Promise<Metadata> {
  const { id, updateId } = await params;
  const venture = getVentureDetail(id);
  const update = venture?.updates.find((u) => u.id === updateId);
  return { title: update?.title ?? updateId };
}

export default async function ProjectUpdatePage({
  params,
}: {
  params: Promise<{ id: string; updateId: string }>;
}) {
  const { id, updateId } = await params;
  const locale = await getLocale();
  const dict = await getDictionary(locale, 'ventures');
  const venture = getVentureDetail(id);
  if (!venture) notFound();
  const update = venture.updates.find((u) => u.id === updateId);
  if (!update) notFound();
  return (
    <div className="mx-auto w-full max-w-[760px] px-5 py-8">
      <UpdatePermalinkView locale={locale} dict={dict} venture={venture} update={update} />
    </div>
  );
}
