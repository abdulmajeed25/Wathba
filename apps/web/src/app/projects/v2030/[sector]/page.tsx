import type { Metadata } from 'next';

import { V2030SectorView } from '@/components/ventures/v2030-sector-view';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { getLocale } from '@/lib/i18n/server';
import { FIXTURE_SECTORS } from '@/lib/ventures/fixtures';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sector: string }>;
}): Promise<Metadata> {
  const { sector } = await params;
  const name = FIXTURE_SECTORS.find((s) => s.slug === sector)?.name ?? sector;
  return { title: name };
}

export default async function V2030SectorPage({ params }: { params: Promise<{ sector: string }> }) {
  const { sector } = await params;
  const locale = await getLocale();
  const dict = await getDictionary(locale, 'ventures');
  return (
    <div className="mx-auto w-full max-w-[1080px] px-5 py-8">
      <V2030SectorView locale={locale} dict={dict} slug={sector} />
    </div>
  );
}
