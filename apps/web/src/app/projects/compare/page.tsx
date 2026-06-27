import type { Metadata } from 'next';

import { VenturesCompareView } from '@/components/ventures/compare-view';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { getLocale } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const dict = await getDictionary(locale, 'ventures');
  return { title: dict.meta.compare };
}

export default async function ProjectsComparePage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale, 'ventures');
  return (
    <div className="mx-auto w-full max-w-[1080px] px-5 py-8">
      <VenturesCompareView locale={locale} dict={dict} />
    </div>
  );
}
