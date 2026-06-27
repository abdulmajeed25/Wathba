import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PostmortemView } from '@/components/ventures/postmortem-view';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { getLocale } from '@/lib/i18n/server';
import { findVenture } from '@/lib/ventures/fixtures';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const venture = findVenture(id);
  return { title: venture ? `Postmortem · ${venture.name}` : id };
}

export default async function ProjectPostmortemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const dict = await getDictionary(locale, 'ventures');
  const venture = findVenture(id);
  if (!venture) notFound();
  return (
    <div className="mx-auto w-full max-w-[760px] px-5 py-8">
      <PostmortemView locale={locale} dict={dict} venture={venture} />
    </div>
  );
}
